import { randomUUID } from 'node:crypto';
import {
  AUDIT_ACTION,
  SALES_MONTH_TABS,
  columnLetter,
  collectionPeriod,
  findPaymentHeaderRow,
  isTeamSupervisorRole,
  normalizeShopId,
  requirePaymentColumns,
  salesPaymentPatchSchema,
  type SalesPaymentsView,
  type SessionUser,
} from '@teakflow/shared';
import { AppError } from '../../middlewares/errorHandler/index';
import { AuditLog } from '../../models/auditLog';
import { SalesPaymentLedger } from '../../models/salesPaymentLedger';
import { User } from '../../models/user';
import { getCompanySettings } from '../settings/index';
import { assertCanOpenSales } from './access';
import { findYearWorkbook, isSalesSheetConfigured, listSheetTabs, readSheetValues, writeSheetCells } from './googleSheets';

const VIEW_TTL_MS = 90_000;
const viewCache = new Map<string, { view: SalesPaymentsView; at: number }>();

function cacheKey(year: number, month: string) {
  return `${year}:${month}`;
}

async function scopePaymentsForUser(user: SessionUser, view: SalesPaymentsView) {
  return { ...view, fullWorkbook: isTeamSupervisorRole(user.role) };
}

function cell(row: string[], index: number) {
  return index >= 0 ? String(row[index] ?? '') : '';
}

function toRow(headers: string[], row: string[], sheetRow: number) {
  const { index } = requirePaymentColumns(headers);
  return {
    shopId: normalizeShopId(cell(row, index.ID)),
    shopName: cell(row, index.SHOP_NAME),
    place: cell(row, index.PLACE),
    amount: cell(row, index.AMOUNT),
    gst: cell(row, index.GST),
    status: cell(row, index.STATUS),
    paymentMode: cell(row, index.PAYMENT_MODE),
    date: cell(row, index.DATE),
    reference: cell(row, index.REFERENCE),
    sheetRow,
  };
}

async function persistLedger(
  year: number,
  month: string,
  rows: ReturnType<typeof toRow>[],
  actorId: string | null,
) {
  const payload = rows
    .filter((row) => row.shopId)
    .map((row) => ({
      year,
      month,
      shopId: row.shopId,
      shopName: row.shopName,
      place: row.place,
      amount: row.amount,
      gst: row.gst,
      status: row.status,
      paymentMode: row.paymentMode,
      date: row.date,
      reference: row.reference,
      ...(actorId ? { updatedBy: actorId } : {}),
    }));
  if (!payload.length) {
    return;
  }
  await SalesPaymentLedger.bulkCreate(payload, {
    updateOnDuplicate: [
      'shopName',
      'place',
      'amount',
      'gst',
      'status',
      'paymentMode',
      'date',
      'reference',
      ...(actorId ? (['updatedBy'] as const) : []),
    ],
    conflictAttributes: ['year', 'month', 'shopId'],
  });
}

async function withUpdaterNames(rows: ReturnType<typeof toRow>[], year: number, month: string) {
  const ledgers = await SalesPaymentLedger.findAll({ where: { year, month } });
  const byId = new Map(ledgers.map((row) => [row.shopId, row]));
  const updaterIds = [...new Set(ledgers.map((row) => row.updatedBy).filter(Boolean))] as string[];
  const updaters = updaterIds.length ? await User.findAll({ where: { id: updaterIds } }) : [];
  const names = new Map(updaters.map((person) => [person.id, person.name]));
  return rows.map((row) => {
    const ledger = byId.get(row.shopId);
    return {
      ...row,
      updatedBy: ledger?.updatedBy ?? null,
      updatedByName: ledger?.updatedBy ? names.get(ledger.updatedBy) ?? null : null,
      updatedAt: ledger?.updatedAt ? ledger.updatedAt.toISOString() : null,
    };
  });
}

function paymentView(
  year: number,
  month: string,
  fileName: string,
  tabTitle: string,
  source: 'drive' | 'ledger',
  tabs: string[],
  rows: SalesPaymentsView['rows'],
): SalesPaymentsView {
  return {
    year,
    month,
    fileName,
    tabTitle,
    source,
    fullWorkbook: true,
    tabs: tabs.length ? tabs : [...SALES_MONTH_TABS],
    statusOptions: [...new Set(['PAID', 'PENDING', ...rows.map((row) => row.status).filter(Boolean)])],
    modeOptions: [...new Set(['Cash', 'Cheque', 'UPI', ...rows.map((row) => row.paymentMode).filter(Boolean)])],
    rows,
  };
}

async function viewFromLedger(year: number, month: string, fileName: string, tabs: string[]) {
  const ledgers = await SalesPaymentLedger.findAll({
    where: { year, month },
    order: [['shopId', 'ASC']],
  });
  const updaterIds = [...new Set(ledgers.map((row) => row.updatedBy).filter(Boolean))] as string[];
  const updaters = updaterIds.length ? await User.findAll({ where: { id: updaterIds } }) : [];
  const names = new Map(updaters.map((person) => [person.id, person.name]));
  const rows = ledgers.map((row, index) => ({
    shopId: row.shopId,
    shopName: row.shopName,
    place: row.place,
    amount: row.amount,
    gst: row.gst,
    status: row.status,
    paymentMode: row.paymentMode,
    date: row.date,
    reference: row.reference,
    sheetRow: index + 2,
    updatedBy: row.updatedBy,
    updatedByName: row.updatedBy ? names.get(row.updatedBy) ?? null : null,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  }));
  return paymentView(year, month, fileName, month, 'ledger', tabs, rows);
}

async function loadDrivePayments(workbookYear: number, tab: string) {
  const file = await findYearWorkbook(workbookYear);
  const [sheet, tabs] = await Promise.all([readSheetValues(file.id, tab), listSheetTabs(file.id)]);
  const headerRow = findPaymentHeaderRow(sheet.values);
  if (headerRow < 0) {
    throw new AppError(
      502,
      'SALES_SHEET_ERROR',
      'Could not find a header row with ID and SHOP NAME on this month tab.',
    );
  }
  const headers = (sheet.values[headerRow] ?? []).map((item) => String(item));
  const columns = requirePaymentColumns(headers);
  if (columns.missing.length === 2) {
    throw new AppError(
      502,
      'SALES_SHEET_ERROR',
      'Workbook needs ID and SHOP NAME columns (any capitalization). PLACE, AMOUNT, GST, STATUS, PAYMENT MODE, DATE, REFERNCE NO are read when present.',
    );
  }
  const rows = sheet.values
    .slice(headerRow + 1)
    .map((row, offset) => toRow(headers, row.map(String), headerRow + offset + 2))
    .filter((row) => row.shopId || row.shopName);
  await persistLedger(workbookYear, tab, rows, null).catch(() => undefined);
  const named = await withUpdaterNames(rows, workbookYear, tab);
  return paymentView(workbookYear, tab, file.name, sheet.title, 'drive', tabs, named);
}

export async function listPayments(
  user: SessionUser,
  month?: string,
  year?: number,
  now = new Date(),
  options?: { refresh?: boolean },
) {
  assertCanOpenSales(user);
  const settings = await getCompanySettings();
  const period = collectionPeriod(now, settings.timezone);
  const tab = (month || period.tab).toLowerCase();
  if (!SALES_MONTH_TABS.includes(tab as (typeof SALES_MONTH_TABS)[number])) {
    throw new AppError(400, 'INVALID_DATE', 'Unknown payment month tab.');
  }
  const workbookYear = year ?? period.year;
  const key = cacheKey(workbookYear, tab);
  if (!options?.refresh) {
    const hit = viewCache.get(key);
    if (hit && Date.now() - hit.at < VIEW_TTL_MS) {
      return scopePaymentsForUser(user, hit.view);
    }
  }
  if (!isSalesSheetConfigured()) {
    const ledger = await viewFromLedger(workbookYear, tab, `monthly payment ${workbookYear}`, []);
    if (ledger.rows.length) {
      return scopePaymentsForUser(user, ledger);
    }
    throw new AppError(503, 'SALES_SHEET_NOT_CONFIGURED', 'Connect the yearly payment workbook in Drive first.');
  }
  try {
    const view = await loadDrivePayments(workbookYear, tab);
    viewCache.set(key, { view, at: Date.now() });
    return scopePaymentsForUser(user, view);
  } catch (error) {
    const ledger = await viewFromLedger(workbookYear, tab, `monthly payment ${workbookYear}`, []);
    if (ledger.rows.length) {
      viewCache.set(key, { view: ledger, at: Date.now() });
      return scopePaymentsForUser(user, ledger);
    }
    throw error;
  }
}

export async function patchPayment(user: SessionUser, input: unknown, now = new Date()) {
  assertCanOpenSales(user);
  const parsed = salesPaymentPatchSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Check the payment update.');
  }
  const settings = await getCompanySettings();
  const period = collectionPeriod(now, settings.timezone);
  const tab = parsed.data.month.toLowerCase();
  const workbookYear = parsed.data.year ?? period.year;
  const shopId = normalizeShopId(parsed.data.shopId);
  const wantedName = parsed.data.shopId.trim().toLowerCase();
  const file = await findYearWorkbook(workbookYear);
  const sheet = await readSheetValues(file.id, tab);
  const headerRow = findPaymentHeaderRow(sheet.values);
  if (headerRow < 0) {
    throw new AppError(502, 'SALES_SHEET_ERROR', 'Could not find a header row with ID and SHOP NAME.');
  }
  const headers = (sheet.values[headerRow] ?? []).map((item) => String(item));
  const columns = requirePaymentColumns(headers);
  if (columns.missing.length === 2) {
    throw new AppError(502, 'SALES_SHEET_ERROR', 'Payment ID or SHOP NAME column could not be read from the workbook.');
  }
  let rowIndex = sheet.values.findIndex((row, index) => {
    if (index <= headerRow) {
      return false;
    }
    const current = toRow(headers, row.map(String), index + 1);
    return current.shopId === shopId || current.shopName.trim().toLowerCase() === wantedName;
  });
  if (rowIndex < 0 && parsed.data.sheetRow) {
    const hinted = parsed.data.sheetRow - 1;
    if (hinted > headerRow && hinted < sheet.values.length) {
      rowIndex = hinted;
    }
  }
  if (rowIndex < 0) {
    throw new AppError(404, 'NOT_FOUND', 'That shop is not on this month’s payment sheet.');
  }
  const previous = toRow(headers, (sheet.values[rowIndex] ?? []).map(String), rowIndex + 1);
  let date = parsed.data.date;
  if (!date && /paid/i.test(parsed.data.status) && !previous.date) {
    date = new Intl.DateTimeFormat('en-CA', { timeZone: settings.timezone }).format(now);
  }
  if (previous.date && parsed.data.date === '') {
    date = previous.date;
  }
  const next = {
    ...previous,
    status: parsed.data.status,
    paymentMode: parsed.data.paymentMode,
    date: date ?? '',
    reference: parsed.data.reference,
  };
  const sheetRow = rowIndex + 1;
  const writes = (
    [
      ['STATUS', next.status],
      ['PAYMENT_MODE', next.paymentMode],
      ['DATE', next.date],
      ['REFERENCE', next.reference],
    ] as const
  )
    .filter(([field]) => columns.index[field] >= 0)
    .map(([field, value]) => ({
      range: `${columnLetter(columns.index[field])}${sheetRow}`,
      values: [[value]],
    }));
  if (!writes.length) {
    throw new AppError(502, 'SALES_SHEET_ERROR', 'Workbook is missing STATUS, PAYMENT MODE, DATE, or REFERNCE NO.');
  }
  await writeSheetCells(file.id, tab, writes);
  await persistLedger(workbookYear, tab, [next], user.id);
  await AuditLog.create({
    userId: user.id,
    action: AUDIT_ACTION.SALES_PAYMENT_PATCH,
    entityType: 'sales_payment',
    entityId: randomUUID(),
    metadata: { year: workbookYear, month: tab, shopId: next.shopId || shopId, before: previous, after: next, file: file.name },
  });
  viewCache.delete(cacheKey(workbookYear, tab));
  return listPayments(user, tab, workbookYear, now, { refresh: true });
}
