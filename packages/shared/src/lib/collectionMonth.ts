import { SALES_MONTH_TABS, SALES_PAYMENT_FILE_PREFIX } from '../constants/index';

export type CollectionPeriod = {
  tab: (typeof SALES_MONTH_TABS)[number];
  year: number;
  fileName: string;
  currentTab: (typeof SALES_MONTH_TABS)[number];
  currentYear: number;
};

function partsInZone(now: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    hourCycle: 'h23',
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(now)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return { year: Number(values.year), month: Number(values.month) };
}

export function salesWorkbookName(year: number) {
  return `${SALES_PAYMENT_FILE_PREFIX} ${year}`;
}

/** In September you collect August. In January you collect December of the previous year. */
export function collectionPeriod(now: Date, timezone: string): CollectionPeriod {
  const { year, month } = partsInZone(now, timezone);
  const currentTab = SALES_MONTH_TABS[month - 1] ?? 'january';
  let collectMonth = month - 1;
  let collectYear = year;
  if (collectMonth === 0) {
    collectMonth = 12;
    collectYear = year - 1;
  }
  const tab = SALES_MONTH_TABS[collectMonth - 1] ?? 'december';
  return {
    tab,
    year: collectYear,
    fileName: salesWorkbookName(collectYear),
    currentTab,
    currentYear: year,
  };
}

export function normalizeShopId(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) {
    return '';
  }
  const asNumber = Number(text);
  if (Number.isFinite(asNumber) && /^\d+(\.0+)?$/.test(text)) {
    return String(Math.trunc(asNumber));
  }
  return text;
}
