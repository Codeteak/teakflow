import { randomUUID } from 'node:crypto';
import {
  AUDIT_ACTION,
  SALES_SHOP_CSV_HEADERS,
  findColumnIndex,
  normalizeShopId,
  salesShopBulkSchema,
  salesShopSchema,
  type SessionUser,
} from '@teakflow/shared';
import { AppError } from '../../middlewares/errorHandler/index';
import { AuditLog } from '../../models/auditLog';
import { Shop } from '../../models/shop';
import { assertCanManageShops } from './access';
import { DIRECTORY_SHOPS } from './directory';

function splitCsvLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function detectDelimiter(header: string) {
  const tabs = (header.match(/\t/g) ?? []).length;
  const commas = (header.match(/,/g) ?? []).length;
  return tabs > commas ? '\t' : ',';
}

export function parseShopCsv(raw: string) {
  const text = raw
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .trim();
  if (!text) {
    throw new AppError(400, 'VALIDATION_ERROR', 'The sheet is empty.');
  }
  const lines = text.split('\n').filter((line) => line.trim());
  const delimiter = detectDelimiter(lines[0] ?? '');
  const headers = splitCsvLine(lines[0] ?? '', delimiter);
  const id = findColumnIndex(headers, ['ID', 'SHOP ID', 'SHOPID']);
  const name = findColumnIndex(headers, ['SHOP NAME', 'NAME', 'SHOPNAME']);
  const place = findColumnIndex(headers, ['PLACE', 'LOCATION']);
  if (id < 0 || name < 0) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      `First row needs ID and SHOP NAME. Optional PLACE. Example: ${SALES_SHOP_CSV_HEADERS.join(',')}`,
    );
  }
  const shops = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  for (let row = 1; row < lines.length; row += 1) {
    const cells = splitCsvLine(lines[row] ?? '', delimiter);
    const shopId = normalizeShopId(cells[id]);
    const shopName = cells[name] ?? '';
    const shopPlace = place >= 0 ? (cells[place] ?? '') : '';
    if (!shopId && !shopName) {
      continue;
    }
    const parsed = salesShopSchema.safeParse({
      shopId,
      name: shopName,
      place: shopPlace,
    });
    if (!parsed.success) {
      errors.push(`Row ${row + 1}: need ID and SHOP NAME.`);
      continue;
    }
    if (seen.has(parsed.data.shopId)) {
      errors.push(`Row ${row + 1}: duplicate ID ${parsed.data.shopId}.`);
      continue;
    }
    seen.add(parsed.data.shopId);
    shops.push(parsed.data);
  }
  return { shops, errors };
}

export function shopTemplateCsv() {
  const header = SALES_SHOP_CSV_HEADERS.join(',');
  const rows = DIRECTORY_SHOPS.map((shop) =>
    [shop.shopId, shop.name, shop.place]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(','),
  );
  return [header, ...rows].join('\n');
}

export async function listDirectory() {
  const rows = await Shop.findAll({ order: [['name', 'ASC']] });
  return rows.map((row) => ({ shopId: row.shopId, name: row.name, place: row.place }));
}

async function previewDiff(shops: { shopId: string; name: string; place: string }[]) {
  const existing = await Shop.findAll();
  const byId = new Map(existing.map((row) => [row.shopId, row]));
  let created = 0;
  let updated = 0;
  for (const shop of shops) {
    if (byId.has(shop.shopId)) {
      updated += 1;
    } else {
      created += 1;
    }
  }
  return { created, updated };
}

export async function previewShopCsv(user: SessionUser, csv: string) {
  assertCanManageShops(user);
  const parsed = parseShopCsv(csv);
  if (parsed.shops.length === 0) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      parsed.errors[0] ?? 'No shop rows found.',
    );
  }
  const diff = await previewDiff(parsed.shops);
  return { ...diff, shops: parsed.shops, errors: parsed.errors, confirm: false };
}

export async function upsertShops(user: SessionUser, input: unknown) {
  assertCanManageShops(user);
  const parsed = salesShopBulkSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Each shop needs ID and SHOP NAME.');
  }
  if (!parsed.data.confirm) {
    const diff = await previewDiff(parsed.data.shops);
    return { ...diff, shops: parsed.data.shops, confirm: false };
  }
  let created = 0;
  let updated = 0;
  for (const shop of parsed.data.shops) {
    const shopId = normalizeShopId(shop.shopId);
    const [row, isNew] = await Shop.findOrCreate({
      where: { shopId },
      defaults: { shopId, name: shop.name, place: shop.place },
    });
    if (isNew) {
      created += 1;
    } else {
      row.name = shop.name;
      row.place = shop.place;
      await row.save();
      updated += 1;
    }
  }
  await AuditLog.create({
    userId: user.id,
    action: AUDIT_ACTION.SALES_SHOP_UPSERT,
    entityType: 'shop',
    entityId: randomUUID(),
    metadata: { created, updated, count: parsed.data.shops.length },
  });
  return { created, updated, shops: await listDirectory(), confirm: true };
}

export async function upsertShopsFromCsv(
  user: SessionUser,
  csv: string,
  confirm: boolean,
) {
  const parsed = parseShopCsv(csv);
  if (parsed.shops.length === 0) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      parsed.errors[0] ?? 'No shop rows found.',
    );
  }
  if (!confirm) {
    const diff = await previewDiff(parsed.shops);
    return { ...diff, shops: parsed.shops, errors: parsed.errors, confirm: false };
  }
  const result = await upsertShops(user, { shops: parsed.shops, confirm: true });
  return { ...result, errors: parsed.errors };
}

export async function updateShop(user: SessionUser, shopIdRaw: string, input: unknown) {
  assertCanManageShops(user);
  const shopId = normalizeShopId(shopIdRaw);
  const parsed = salesShopSchema.safeParse({ ...(input as object), shopId });
  if (!parsed.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Shop needs ID and SHOP NAME.');
  }
  const row = await Shop.findOne({ where: { shopId } });
  if (!row) {
    throw new AppError(404, 'NOT_FOUND', 'That shop is not in the directory.');
  }
  row.name = parsed.data.name;
  row.place = parsed.data.place;
  await row.save();
  await AuditLog.create({
    userId: user.id,
    action: AUDIT_ACTION.SALES_SHOP_UPSERT,
    entityType: 'shop',
    entityId: randomUUID(),
    metadata: { shopId, name: row.name },
  });
  return { shops: await listDirectory() };
}

export async function deleteShop(user: SessionUser, shopIdRaw: string) {
  assertCanManageShops(user);
  const shopId = normalizeShopId(shopIdRaw);
  const row = await Shop.findOne({ where: { shopId } });
  if (!row) {
    throw new AppError(404, 'NOT_FOUND', 'That shop is not in the directory.');
  }
  await row.destroy();
  await AuditLog.create({
    userId: user.id,
    action: AUDIT_ACTION.SALES_SHOP_DELETE,
    entityType: 'shop',
    entityId: randomUUID(),
    metadata: { shopId, name: row.name },
  });
  return { shops: await listDirectory() };
}
