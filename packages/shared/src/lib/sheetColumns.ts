export function normalizeColumnName(value: string) {
  return value
    .replace(/^\uFEFF/, '')
    .replace(/[\n\r]+/g, ' ')
    .trim()
    .toUpperCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

export function findColumnIndex(headers: string[], aliases: string[]) {
  const wanted = new Set(aliases.map(normalizeColumnName));
  return headers.findIndex((header) => wanted.has(normalizeColumnName(header)));
}

export const PAYMENT_COLUMN_ALIASES = {
  ID: ['ID', 'SHOP ID', 'SHOPID'],
  SHOP_NAME: ['SHOP NAME', 'SHOPNAME', 'STORE', 'STORE NAME'],
  PLACE: ['PLACE', 'LOCATION', 'AREA'],
  AMOUNT: ['AMOUNT', 'AMT', 'RS', 'RUPEES'],
  GST: ['GST'],
  STATUS: ['STATUS'],
  PAYMENT_MODE: ['PAYMENT MODE', 'PAYMENTMODE', 'MODE', 'PAY MODE'],
  DATE: ['DATE', 'PAID DATE', 'PAYMENT DATE'],
  REFERENCE: ['REFERNCE NO', 'REFERENCE NO', 'REFERENCE', 'REFERNCE', 'REF', 'REF NO'],
} as const;

export function requirePaymentColumns(headers: string[]) {
  const index = {
    ID: findColumnIndex(headers, [...PAYMENT_COLUMN_ALIASES.ID]),
    SHOP_NAME: findColumnIndex(headers, [...PAYMENT_COLUMN_ALIASES.SHOP_NAME]),
    PLACE: findColumnIndex(headers, [...PAYMENT_COLUMN_ALIASES.PLACE]),
    AMOUNT: findColumnIndex(headers, [...PAYMENT_COLUMN_ALIASES.AMOUNT]),
    GST: findColumnIndex(headers, [...PAYMENT_COLUMN_ALIASES.GST]),
    STATUS: findColumnIndex(headers, [...PAYMENT_COLUMN_ALIASES.STATUS]),
    PAYMENT_MODE: findColumnIndex(headers, [...PAYMENT_COLUMN_ALIASES.PAYMENT_MODE]),
    DATE: findColumnIndex(headers, [...PAYMENT_COLUMN_ALIASES.DATE]),
    REFERENCE: findColumnIndex(headers, [...PAYMENT_COLUMN_ALIASES.REFERENCE]),
  };
  const missingCore: string[] = [];
  if (index.ID < 0) missingCore.push('ID');
  if (index.SHOP_NAME < 0) missingCore.push('SHOP NAME');
  return { index, missing: missingCore };
}

export function findPaymentHeaderRow(values: string[][]) {
  const limit = Math.min(values.length, 25);
  for (let row = 0; row < limit; row += 1) {
    const { missing } = requirePaymentColumns((values[row] ?? []).map(String));
    if (missing.length === 0) {
      return row;
    }
  }
  for (let row = 0; row < limit; row += 1) {
    const { index } = requirePaymentColumns((values[row] ?? []).map(String));
    if (index.ID >= 0 || index.SHOP_NAME >= 0) {
      return row;
    }
  }
  return -1;
}

export function columnLetter(index: number) {
  let n = index + 1;
  let label = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}
