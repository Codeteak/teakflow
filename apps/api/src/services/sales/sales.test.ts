import { describe, expect, it } from 'vitest';
import {
  SALES_DAILY_CSV_HEADERS,
  collectionPeriod,
  findPaymentHeaderRow,
  normalizeShopId,
  requirePaymentColumns,
  salesWorkbookName,
} from '@teakflow/shared';
import { expandReportRows, reportsToCsv } from './csv';

describe('collectionPeriod', () => {
  it('opens august when today is in September', () => {
    const period = collectionPeriod(new Date('2026-09-18T08:00:00.000Z'), 'Asia/Kolkata');
    expect(period.tab).toBe('august');
    expect(period.year).toBe(2026);
    expect(period.fileName).toBe('monthly payment 2026');
  });

  it('opens december of the previous year in January', () => {
    const period = collectionPeriod(new Date('2027-01-05T08:00:00.000Z'), 'Asia/Kolkata');
    expect(period.tab).toBe('december');
    expect(period.year).toBe(2026);
    expect(salesWorkbookName(period.year)).toBe('monthly payment 2026');
  });
});

describe('normalizeShopId', () => {
  it('treats excel 100022.0 as 100022', () => {
    expect(normalizeShopId('100022.0')).toBe('100022');
  });
});

describe('payment columns', () => {
  it('matches SHOP ID as the ID column', () => {
    const { index, missing } = requirePaymentColumns(['SHOP ID', 'SHOP NAME', 'PLACE']);
    expect(missing).toEqual([]);
    expect(index.ID).toBe(0);
  });

  it('matches PLACE and REFERNCE NO regardless of case', () => {
    const { missing } = requirePaymentColumns([
      'id',
      'Shop Name',
      'Place',
      'amount',
      'gst',
      'Status',
      'payment mode',
      'date',
      'Refernce No',
    ]);
    expect(missing).toEqual([]);
  });

  it('finds the header under a title row', () => {
    expect(
      findPaymentHeaderRow([
        ['monthly payment 2026'],
        [
          'ID',
          'SHOP NAME',
          'PLACE',
          'AMOUNT',
          'GST',
          'STATUS',
          'PAYMENT MODE',
          'DATE',
          'REFERNCE NO',
        ],
      ]),
    ).toBe(1);
  });
});

describe('shop csv', () => {
  it('upserts rows from the payment-sheet header', async () => {
    const { parseShopCsv } = await import('./shops');
    const parsed = parseShopCsv(
      `ID,SHOP NAME,PLACE\n100022.0,Families Hypermart,K R Puram\n`,
    );
    expect(parsed.shops).toEqual([
      { shopId: '100022', name: 'Families Hypermart', place: 'K R Puram' },
    ]);
  });

  it('reads tab-separated PLACE in any case', async () => {
    const { parseShopCsv } = await import('./shops');
    const parsed = parseShopCsv(
      'id\tshop name\tPlace\n100026\tRolla Hyper Market Begur\tBegur\n',
    );
    expect(parsed.shops[0]).toMatchObject({ shopId: '100026', place: 'Begur' });
  });
});

describe('frozen daily csv', () => {
  it('keeps Issues and Updates columns', () => {
    expect([...SALES_DAILY_CSV_HEADERS]).toEqual([
      'Date',
      'Salesman',
      'Inst.',
      'Inst. Shop',
      'Demo',
      'Demo Shop',
      'Received',
      'Rec. Shop',
      'GST',
      'Payment Ref',
      'Bank Name',
      'Cash',
      'Cheque',
      'UPI',
      'Issues',
      'Updates',
      'Visits',
      'Visit Shop',
      'Fuel',
    ]);
    const csv = reportsToCsv([
      {
        workDate: '2026-09-18',
        userId: 'u1',
        salesmanName: 'Meera Sales',
        instCount: 1,
        instShops: 'Shop A',
        demoCount: 0,
        demoShops: '',
        received: 100,
        recShops: 'Shop A',
        gst: 'GST',
        paymentRef: 'r1',
        bankName: '',
        amounts: '100',
        modes: 'UPI',
        cash: 0,
        cheque: 0,
        upi: 100,
        issues: '',
        updates: 'Shelf note',
        visits: 1,
        visitShops: 'Shop A',
        fuel: 0,
        fuelLocked: false,
        notebookBlocks: '',
      },
    ]);
    expect(csv.split('\n')[0]).toContain('Issues,Updates');
    expect(csv).toContain('Shelf note');
    expect(
      expandReportRows({
        workDate: '2026-09-18',
        userId: 'u1',
        salesmanName: 'Meera Sales',
        instCount: 0,
        instShops: '',
        demoCount: 0,
        demoShops: '',
        received: 90,
        recShops: 'A, B',
        gst: 'GST, GST',
        paymentRef: '1, 2',
        bankName: ',',
        amounts: '40, 50',
        modes: 'Cash, UPI',
        cash: 40,
        cheque: 0,
        upi: 50,
        issues: '',
        updates: 'n',
        visits: 0,
        visitShops: '',
        fuel: 0,
        fuelLocked: false,
        notebookBlocks: '',
      }),
    ).toHaveLength(2);
  });
});

describe('visit notebook', () => {
  it('keeps one shop block then the next without replacing the first', async () => {
    const { formatVisitBlock, mergeNotebook } = await import('./notebook');
    const first = formatVisitBlock(
      {
        shopId: '1',
        shopName: 'Shop A',
        place: 'A',
        kind: 'VISIT',
        count: 1,
        notes: 'First shop',
      },
      new Date('2026-09-18T08:00:00.000Z'),
      'Asia/Kolkata',
      1,
    );
    const second = formatVisitBlock(
      {
        shopId: '2',
        shopName: 'Shop B',
        place: 'B',
        kind: 'VISIT',
        count: 1,
        notes: 'Second shop',
      },
      new Date('2026-09-18T10:00:00.000Z'),
      'Asia/Kolkata',
      2,
    );
    const merged = mergeNotebook(first, second);
    expect(first.startsWith('# 1. Shop A')).toBe(true);
    expect(first).toContain('---');
    expect(second.startsWith('# 2. Shop B')).toBe(true);
    expect(first).toContain('> ');
    expect(first).toContain('ID 1');
    expect(merged).toContain('First shop');
    expect(merged).toContain('Second shop');
    expect(merged.indexOf('Shop A')).toBeLessThan(merged.indexOf('Shop B'));
  });
});

describe('fuelAlreadySaved', () => {
  it('allows the first fuel save of the day', async () => {
    const { fuelAlreadySaved } = await import('./fuelLock');
    expect(fuelAlreadySaved(null)).toBe(false);
    expect(fuelAlreadySaved({ fuel: 0, fuelLocked: false })).toBe(false);
  });

  it('locks after fuel is saved', async () => {
    const { fuelAlreadySaved } = await import('./fuelLock');
    expect(fuelAlreadySaved({ fuel: 250, fuelLocked: false })).toBe(true);
    expect(fuelAlreadySaved({ fuel: 0, fuelLocked: true })).toBe(true);
  });
});
