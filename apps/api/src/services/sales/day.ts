import { Op } from 'sequelize';
import {
  SALES_VISIT_KIND,
  salesDaySaveSchema,
  type Role,
  type SalesDayReport as SalesDayReportDto,
  type SalesReceivedInput,
  type SalesVisitInput,
  type SessionUser,
} from '@teakflow/shared';
import { DailyWorkEntry } from '../../models/dailyWorkEntry';
import { SalesDayReport } from '../../models/salesDayReport';
import { SalesPaymentReceived } from '../../models/salesPaymentReceived';
import { SalesVisit } from '../../models/salesVisit';
import { AppError } from '../../middlewares/errorHandler/index';
import { getCompanySettings } from '../settings/index';
import { clockParts } from '../dailyWork/window';
import { assertCanOpenSales, listSalesPeople } from './access';
import { patchPayment } from './payments';
import { composeNotebook, formatVisitBlock, mergeNotebook } from './notebook';
import { reportsToCsv, shopSummaryCsv } from './csv';
import { fuelAlreadySaved } from './fuelLock';
import { listDirectory } from './shops';

function joinShops(names: string[]) {
  return names.filter(Boolean).join(', ');
}

export async function listShops() {
  return listDirectory();
}

export async function saveSalesDay(user: SessionUser, input: unknown, now = new Date()) {
  assertCanOpenSales(user);
  const parsed = salesDaySaveSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Check the sales day details.');
  }
  const settings = await getCompanySettings();
  const { workDate } = clockParts(now, settings.timezone);
  const directory = await listDirectory();
  const byId = new Map(directory.map((shop) => [shop.shopId, shop]));
  const existing = await SalesDayReport.findOne({ where: { userId: user.id, workDate } });
  let notebookBlocks = existing?.notebookBlocks ?? '';

  if (parsed.data.section === 'visit' && parsed.data.visit) {
    const visit = parsed.data.visit;
    const known = visit.shopId ? byId.get(visit.shopId) : undefined;
    const already = await SalesVisit.count({ where: { userId: user.id, workDate } });
    await SalesVisit.create({
      userId: user.id,
      workDate,
      shopId: known?.shopId ?? null,
      shopName: known?.name ?? visit.shopName,
      place: known?.place ?? visit.place,
      listed: Boolean(known),
      kind: visit.kind,
      count: visit.count,
      notes: visit.notes,
    });
    const block = formatVisitBlock(
      {
        shopId: known?.shopId ?? visit.shopId ?? null,
        shopName: known?.name ?? visit.shopName,
        place: known?.place ?? visit.place,
        kind: visit.kind,
        count: visit.count,
        notes: visit.notes,
      },
      now,
      settings.timezone,
      already + 1,
    );
    notebookBlocks = mergeNotebook(notebookBlocks, block);
    const entry = await DailyWorkEntry.findOne({ where: { userId: user.id, workDate } });
    if (entry) {
      entry.allowWindowEdit = true;
      entry.content = mergeNotebook(entry.content, block);
      await entry.save();
    }
  }

  if (parsed.data.section === 'received' && parsed.data.received) {
    const row = parsed.data.received;
    if (!row.shopName.trim() || row.amount <= 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Add a shop and amount for this payment.');
    }
    const known = row.shopId ? byId.get(row.shopId) : undefined;
    if (row.month) {
      await patchPayment(user, {
        year: row.year,
        month: row.month,
        shopId: (row.shopId || row.shopName).trim(),
        sheetRow: row.sheetRow,
        status: 'PAID',
        paymentMode: row.mode,
        date: workDate,
        reference: row.ref,
      }, now);
    }
    await SalesPaymentReceived.create({
      userId: user.id,
      workDate,
      shopId: known?.shopId ?? null,
      shopName: known?.name ?? row.shopName,
      amount: row.amount,
      gst: row.gst,
      ref: row.ref,
      mode: row.mode,
      bankName: row.mode === 'Cheque' ? row.bankName : '',
    });
  }

  const visits = await SalesVisit.findAll({ where: { userId: user.id, workDate } });
  const received = await SalesPaymentReceived.findAll({ where: { userId: user.id, workDate } });
  if (parsed.data.section === 'fuel') {
    if (fuelAlreadySaved(existing)) {
      throw new AppError(409, 'FUEL_LOCKED', 'Fuel is already saved for today. One fuel entry per work date.');
    }
    if (!(parsed.data.fuel && parsed.data.fuel > 0)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Add today’s fuel amount.');
    }
  }
  const fuel = parsed.data.section === 'fuel' ? parsed.data.fuel ?? 0 : existing?.fuel ?? 0;
  const fuelLocked = parsed.data.section === 'fuel' ? true : fuelAlreadySaved(existing);
  await upsertDayReport(user, workDate, visits, received, fuel, fuelLocked, notebookBlocks);
  return getSalesDay(user, now);
}

async function upsertDayReport(
  user: SessionUser,
  workDate: string,
  visits: SalesVisit[],
  received: SalesPaymentReceived[],
  fuel: number,
  fuelLocked: boolean,
  notebookBlocks: string,
) {
  const visitInputs: SalesVisitInput[] = visits.map((visit) => ({
    shopId: visit.shopId,
    shopName: visit.shopName,
    place: visit.place,
    kind: visit.kind as SalesVisitInput['kind'],
    count: visit.count,
    notes: visit.notes,
  }));
  const receivedInputs: SalesReceivedInput[] = received.map((row) => ({
    shopId: row.shopId,
    shopName: row.shopName,
    amount: row.amount,
    gst: row.gst === 'Non-GST' ? 'Non-GST' : 'GST',
    ref: row.ref,
    mode: row.mode === 'Cheque' || row.mode === 'UPI' ? row.mode : 'Cash',
    bankName: row.bankName,
  }));
  const installations = visitInputs.filter((visit) => visit.kind === SALES_VISIT_KIND.INSTALLATION);
  const demos = visitInputs.filter((visit) => visit.kind === SALES_VISIT_KIND.DEMO);
  const storeVisits = visitInputs.filter((visit) => visit.kind === SALES_VISIT_KIND.VISIT);
  const cash = receivedInputs.filter((row) => row.mode === 'Cash').reduce((sum, row) => sum + row.amount, 0);
  const cheque = receivedInputs.filter((row) => row.mode === 'Cheque').reduce((sum, row) => sum + row.amount, 0);
  const upi = receivedInputs.filter((row) => row.mode === 'UPI').reduce((sum, row) => sum + row.amount, 0);
  const payload = {
    userId: user.id,
    workDate,
    salesmanName: user.name,
    instCount: installations.reduce((sum, row) => sum + row.count, 0),
    instShops: joinShops(installations.map((row) => row.shopName)),
    demoCount: demos.reduce((sum, row) => sum + row.count, 0),
    demoShops: joinShops(demos.map((row) => row.shopName)),
    received: receivedInputs.reduce((sum, row) => sum + row.amount, 0),
    recShops: joinShops(receivedInputs.map((row) => row.shopName)),
    gst: receivedInputs.map((row) => row.gst).join(', '),
    paymentRef: receivedInputs.map((row) => row.ref).filter(Boolean).join(', '),
    bankName: receivedInputs.map((row) => (row.mode === 'Cheque' ? row.bankName : '')).join(', '),
    amounts: receivedInputs.map((row) => row.amount).join(', '),
    modes: receivedInputs.map((row) => row.mode).join(', '),
    cash,
    cheque,
    upi,
    issues: '',
    updates: notebookBlocks || composeNotebook(visitInputs, new Date(), 'Asia/Kolkata'),
    visits: storeVisits.reduce((sum, row) => sum + row.count, 0),
    visitShops: joinShops(storeVisits.map((row) => row.shopName)),
    fuel,
    fuelLocked,
    notebookBlocks,
  };
  const [report] = await SalesDayReport.findOrCreate({
    where: { userId: user.id, workDate },
    defaults: payload,
  });
  await report.update(payload);
  return report;
}

export async function getSalesDay(user: SessionUser, now = new Date()) {
  assertCanOpenSales(user);
  const settings = await getCompanySettings();
  const { workDate } = clockParts(now, settings.timezone);
  const report = await SalesDayReport.findOne({ where: { userId: user.id, workDate } });
  const visits = await SalesVisit.findAll({ where: { userId: user.id, workDate } });
  const received = await SalesPaymentReceived.findAll({ where: { userId: user.id, workDate } });
  return {
    workDate,
    report: report ? toDto(report) : null,
    visits: visits.map((row) => ({
      id: row.id,
      shopId: row.shopId,
      shopName: row.shopName,
      place: row.place,
      listed: row.listed,
      kind: row.kind,
      count: row.count,
      notes: row.notes,
    })),
    received: received.map((row) => ({
      id: row.id,
      shopId: row.shopId,
      shopName: row.shopName,
      amount: row.amount,
      gst: row.gst,
      ref: row.ref,
      mode: row.mode,
      bankName: row.bankName,
    })),
    shops: await listShops(),
  };
}

function workDateFilter(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }
  const [year, month, day] = value.split('-').map(Number);
  if (year == null || month == null || day == null) {
    return undefined;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return undefined;
  }
  return value;
}

export async function salesDashboard(user: SessionUser, from?: string, to?: string, salesmanId?: string, now = new Date()) {
  assertCanOpenSales(user);
  const settings = await getCompanySettings();
  const { workDate } = clockParts(now, settings.timezone);
  const people = await listSalesPeople(user.id, user.role as Role);
  const allowed = people.map((person) => person.id);
  if (salesmanId && !allowed.includes(salesmanId)) {
    throw new AppError(403, 'FORBIDDEN', 'You can only view reports for people in your Sales tree.');
  }
  const ids = salesmanId ? [salesmanId] : allowed;
  const fromDate = workDateFilter(from);
  const toDate = workDateFilter(to);
  const where: Record<string, unknown> = {
    userId: { [Op.in]: ids.length ? ids : ['00000000-0000-4000-8000-000000000000'] },
  };
  if (fromDate || toDate) {
    where.workDate = {
      ...(fromDate ? { [Op.gte]: fromDate } : {}),
      ...(toDate ? { [Op.lte]: toDate } : {}),
    };
  }
  const rows = await SalesDayReport.findAll({ where, order: [['workDate', 'DESC']] });
  const dtos = rows.map(toDto);
  return {
    workDate,
    collectionMonth: '',
    collectionYear: 0,
    people: people.map((person) => ({ id: person.id, name: person.name })),
    totals: {
      inst: dtos.reduce((sum, row) => sum + row.instCount, 0),
      demos: dtos.reduce((sum, row) => sum + row.demoCount, 0),
      visits: dtos.reduce((sum, row) => sum + row.visits, 0),
      received: dtos.reduce((sum, row) => sum + row.received, 0),
      cash: dtos.reduce((sum, row) => sum + row.cash, 0),
      cheque: dtos.reduce((sum, row) => sum + row.cheque, 0),
      upi: dtos.reduce((sum, row) => sum + row.upi, 0),
      fuel: dtos.reduce((sum, row) => sum + row.fuel, 0),
      reports: dtos.length,
    },
    rows: dtos,
  };
}

export async function salesCsv(user: SessionUser, from?: string, to?: string, salesmanId?: string) {
  const view = await salesDashboard(user, from, to, salesmanId);
  return reportsToCsv(view.rows);
}

export async function salesSummaryCsv(user: SessionUser, from?: string, to?: string, salesmanId?: string) {
  if (user.role === 'EMPLOYEE') {
    throw new AppError(403, 'FORBIDDEN', 'Shop summary download is for your manager, lead, or admin.');
  }
  const view = await salesDashboard(user, from, to, salesmanId);
  return shopSummaryCsv(view.rows, `${from ?? ''}–${to ?? 'all'}`);
}

export async function shopScopeThisMonth(userIds: string[], year: number, monthIndex: number) {
  const pad = (value: number) => String(value).padStart(2, '0');
  const from = `${year}-${pad(monthIndex)}-01`;
  const last = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  const to = `${year}-${pad(monthIndex)}-${pad(last)}`;
  const visits = await SalesVisit.findAll({
    where: { userId: { [Op.in]: userIds }, workDate: { [Op.gte]: from, [Op.lte]: to } },
  });
  const received = await SalesPaymentReceived.findAll({
    where: { userId: { [Op.in]: userIds }, workDate: { [Op.gte]: from, [Op.lte]: to } },
  });
  const ids = new Set<string>();
  const names = new Set<string>();
  [...visits, ...received].forEach((row) => {
    if (row.shopId) {
      ids.add(row.shopId);
    }
    if (row.shopName.trim()) {
      names.add(row.shopName.trim().toLowerCase());
    }
  });
  return { ids, names };
}

export async function shopIdsTouchedThisMonth(userIds: string[], year: number, monthIndex: number) {
  const scope = await shopScopeThisMonth(userIds, year, monthIndex);
  return scope.ids;
}

function toDto(row: SalesDayReport): SalesDayReportDto {
  return {
    workDate: row.workDate,
    userId: row.userId,
    salesmanName: row.salesmanName,
    instCount: row.instCount,
    instShops: row.instShops,
    demoCount: row.demoCount,
    demoShops: row.demoShops,
    received: row.received,
    recShops: row.recShops,
    gst: row.gst,
    paymentRef: row.paymentRef,
    bankName: row.bankName,
    amounts: row.amounts,
    modes: row.modes,
    cash: row.cash,
    cheque: row.cheque,
    upi: row.upi,
    issues: row.issues,
    updates: row.updates,
    visits: row.visits,
    visitShops: row.visitShops,
    fuel: row.fuel,
    fuelLocked: Boolean(row.fuelLocked) || row.fuel > 0,
    notebookBlocks: row.notebookBlocks,
  };
}
