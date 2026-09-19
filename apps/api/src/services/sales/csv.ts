import { SALES_DAILY_CSV_HEADERS, type SalesDayReport } from '@teakflow/shared';

type CsvRow = Record<(typeof SALES_DAILY_CSV_HEADERS)[number], string | number>;

function splitField(value: string) {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
}

function csvCell(value: string | number) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function expandReportRows(r: SalesDayReport): CsvRow[] {
  const shopsArr = splitField(r.recShops);
  const amountsArr = splitField(r.amounts).map(Number);
  const gstArr = splitField(r.gst);
  const refArr = splitField(r.paymentRef);
  const bankArr = splitField(r.bankName);
  const modesArr = splitField(r.modes);
  const canSplit =
    shopsArr.length > 1 &&
    amountsArr.length === shopsArr.length &&
    modesArr.length === shopsArr.length;

  if (!canSplit) {
    return [
      {
        Date: r.workDate,
        Salesman: r.salesmanName,
        'Inst.': r.instCount,
        'Inst. Shop': r.instShops,
        Demo: r.demoCount,
        'Demo Shop': r.demoShops,
        Received: r.received,
        'Rec. Shop': r.recShops,
        GST: r.gst,
        'Payment Ref': r.paymentRef,
        'Bank Name': r.bankName,
        Cash: r.cash,
        Cheque: r.cheque,
        UPI: r.upi,
        Issues: r.issues,
        Updates: r.updates,
        Visits: r.visits,
        'Visit Shop': r.visitShops,
        Fuel: r.fuel,
      },
    ];
  }

  return shopsArr.map((shop, i) => {
    const amount = amountsArr[i] || 0;
    const mode = modesArr[i] || '';
    const isFirst = i === 0;
    return {
      Date: r.workDate,
      Salesman: r.salesmanName,
      'Inst.': isFirst ? r.instCount : '',
      'Inst. Shop': isFirst ? r.instShops : '',
      Demo: isFirst ? r.demoCount : '',
      'Demo Shop': isFirst ? r.demoShops : '',
      Received: amount,
      'Rec. Shop': shop,
      GST: gstArr[i] || '',
      'Payment Ref': refArr[i] || '',
      'Bank Name': bankArr[i] || '',
      Cash: mode === 'Cash' ? amount : '',
      Cheque: mode === 'Cheque' ? amount : '',
      UPI: mode === 'UPI' ? amount : '',
      Issues: isFirst ? r.issues : '',
      Updates: isFirst ? r.updates : '',
      Visits: isFirst ? r.visits : '',
      'Visit Shop': isFirst ? r.visitShops : '',
      Fuel: isFirst ? r.fuel : '',
    };
  });
}

export function reportsToCsv(rows: SalesDayReport[]) {
  const dataRows = rows.flatMap(expandReportRows);
  const lines = [
    SALES_DAILY_CSV_HEADERS.join(','),
    ...dataRows.map((row) =>
      SALES_DAILY_CSV_HEADERS.map((header) => csvCell(row[header] ?? '')).join(','),
    ),
  ];
  return lines.join('\n');
}

export function shopSummaryCsv(rows: SalesDayReport[], monthLabel: string) {
  const buckets = {
    Cash: new Map<string, number>(),
    Cheque: new Map<string, number>(),
    UPI: new Map<string, number>(),
  };
  rows.forEach((report) => {
    expandReportRows(report).forEach((row) => {
      const shop = String(row['Rec. Shop'] || '');
      const amt = Number(row.Received) || 0;
      if (!shop || amt <= 0) {
        return;
      }
      const mode =
        Number(row.Cash) > 0
          ? 'Cash'
          : Number(row.Cheque) > 0
            ? 'Cheque'
            : Number(row.UPI) > 0
              ? 'UPI'
              : null;
      if (!mode) {
        return;
      }
      const gst = row.GST === 'Non-GST' ? 'Non-GST' : 'GST';
      const key = `${shop}\u0001${gst}`;
      buckets[mode].set(key, (buckets[mode].get(key) || 0) + amt);
    });
  });
  const lines: string[] = [`${csvCell(monthLabel)},,`, ''];
  let grand = 0;
  (['Cash', 'Cheque', 'UPI'] as const).forEach((mode) => {
    const list = [...buckets[mode].entries()]
      .map(([key, amount]) => {
        const [shop, gst] = key.split('\u0001');
        return { shop, gst, amount };
      })
      .sort((a, b) => b.amount - a.amount);
    if (list.length === 0) {
      return;
    }
    const sub = list.reduce((sum, item) => sum + item.amount, 0);
    grand += sub;
    lines.push(`${csvCell(mode)},,`);
    lines.push(['Shop', 'Amount', 'GST'].map(csvCell).join(','));
    list.forEach((item) =>
      lines.push([item.shop ?? '', item.amount, item.gst ?? ''].map(csvCell).join(',')),
    );
    lines.push(['Subtotal', sub, ''].map(csvCell).join(','));
    lines.push('');
  });
  lines.push(['Grand total', grand, ''].map(csvCell).join(','));
  return lines.join('\n');
}
