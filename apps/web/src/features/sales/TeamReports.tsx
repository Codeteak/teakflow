import { useMemo, useState, type ReactNode } from 'react';
import type { SalesDashboard, SalesDayReport } from '@teakflow/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { fetchSalesCsv, salesCsvFilename } from '@/features/sales/api';
import { CsvSheetPreview, type CsvSheetSource } from '@/features/sales/CsvSheetPreview';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function currentMonthRange(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  return monthRange(year, month + 1);
}

export function monthRange(year: number, month: number) {
  const last = new Date(year, month, 0).getDate();
  return {
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(last)}`,
  };
}

export function monthRangeFromKey(key: string) {
  const [year, month] = key.split('-').map(Number);
  if (year == null || month == null) {
    const now = new Date();
    return monthRange(now.getFullYear(), now.getMonth() + 1);
  }
  return monthRange(year, month);
}

function inr(value: number | string) {
  const n = Number(String(value).replace(/,/g, ''));
  if (!Number.isFinite(n) || String(value).trim() === '') {
    return String(value || '—');
  }
  return `₹${n.toLocaleString('en-IN')}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split('-');
  const index = Number(month) - 1;
  return `${MONTH_NAMES[index] || month} ${year}`;
}

function splitField(value: string) {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function shopSummary(rows: SalesDayReport[]) {
  const buckets = {
    Cash: new Map<string, { shop: string; gst: string; amount: number }>(),
    Cheque: new Map<string, { shop: string; gst: string; amount: number }>(),
    UPI: new Map<string, { shop: string; gst: string; amount: number }>(),
  };
  rows.forEach((report) => {
    const shops = splitField(report.recShops);
    const amounts = splitField(report.amounts).map(Number);
    const gst = splitField(report.gst);
    const modes = splitField(report.modes);
    const items =
      shops.length > 0
        ? shops.map((shop, index) => ({
            shop,
            amount: amounts[index] || 0,
            gst: gst[index] === 'Non-GST' ? 'Non-GST' : 'GST',
            mode: modes[index] || '',
          }))
        : report.received > 0
          ? [
              {
                shop: report.recShops || '—',
                amount: report.received,
                gst: report.gst === 'Non-GST' ? 'Non-GST' : 'GST',
                mode:
                  report.cash > 0
                    ? 'Cash'
                    : report.cheque > 0
                      ? 'Cheque'
                      : report.upi > 0
                        ? 'UPI'
                        : '',
              },
            ]
          : [];
    items.forEach((item) => {
      if (!item.shop || item.amount <= 0) {
        return;
      }
      const mode =
        item.mode === 'Cash' || item.mode === 'Cheque' || item.mode === 'UPI'
          ? item.mode
          : null;
      if (!mode) {
        return;
      }
      const key = `${item.shop}\u0001${item.gst}`;
      const current = buckets[mode].get(key);
      buckets[mode].set(key, {
        shop: item.shop,
        gst: item.gst,
        amount: (current?.amount ?? 0) + item.amount,
      });
    });
  });
  const list = (mode: keyof typeof buckets) =>
    [...buckets[mode].values()].sort((a, b) => b.amount - a.amount);
  return { Cash: list('Cash'), Cheque: list('Cheque'), UPI: list('UPI') };
}

function inRange(row: SalesDayReport, from: string, to: string) {
  if (from && row.workDate < from) {
    return false;
  }
  if (to && row.workDate > to) {
    return false;
  }
  return true;
}

export function TeamReports({
  dash,
  onRefresh,
}: {
  dash: SalesDashboard;
  onRefresh: () => void;
}) {
  const month = currentMonthRange();
  const [salesmanId, setSalesmanId] = useState('all');
  const [from, setFrom] = useState(month.from);
  const [to, setTo] = useState(month.to);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [openSalesman, setOpenSalesman] = useState('');
  const [showAllMonths, setShowAllMonths] = useState(false);
  const [csvSheet, setCsvSheet] = useState<CsvSheetSource | null>(null);
  const [summaryMonth, setSummaryMonth] = useState('');

  const bySalesman = useMemo(() => {
    if (salesmanId === 'all') {
      return dash.rows;
    }
    return dash.rows.filter((row) => row.userId === salesmanId);
  }, [dash.rows, salesmanId]);

  const filtered = useMemo(
    () => bySalesman.filter((row) => inRange(row, from, to)),
    [bySalesman, from, to],
  );

  const totals = useMemo(
    () => ({
      reports: filtered.length,
      inst: filtered.reduce((sum, row) => sum + row.instCount, 0),
      demos: filtered.reduce((sum, row) => sum + row.demoCount, 0),
      visits: filtered.reduce((sum, row) => sum + row.visits, 0),
      received: filtered.reduce((sum, row) => sum + row.received, 0),
      cash: filtered.reduce((sum, row) => sum + row.cash, 0),
      cheque: filtered.reduce((sum, row) => sum + row.cheque, 0),
      upi: filtered.reduce((sum, row) => sum + row.upi, 0),
      fuel: filtered.reduce((sum, row) => sum + row.fuel, 0),
    }),
    [filtered],
  );

  const months = useMemo(() => {
    const map = new Map<string, SalesDayReport[]>();
    bySalesman.forEach((row) => {
      const key = row.workDate.slice(0, 7);
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    });
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [bySalesman]);

  const visibleMonths = showAllMonths ? months : months.slice(0, 1);
  const effectiveSummary = summaryMonth || months[0]?.[0] || '';
  const summaryRows = months.find(([key]) => key === effectiveSummary)?.[1] ?? [];
  const summary = shopSummary(summaryRows);
  const hasSummary = summary.Cash.length + summary.Cheque.length + summary.UPI.length > 0;
  const csvFilters = {
    from: from || undefined,
    to: to || undefined,
    salesmanId: salesmanId === 'all' ? undefined : salesmanId,
  };

  return (
    <div className="space-y-4">
      <CsvSheetPreview source={csvSheet} onClose={() => setCsvSheet(null)} />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-8 px-3 text-xs"
          onClick={onRefresh}
        >
          Refresh
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-8 px-3 text-xs"
          onClick={() =>
            setCsvSheet({
              title: 'Daily export',
              filename: salesCsvFilename('export'),
              load: () => fetchSalesCsv('export', csvFilters),
            })
          }
        >
          Export CSV
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-8 px-3 text-xs"
          onClick={() =>
            setCsvSheet({
              title: 'Shop summary',
              filename: salesCsvFilename('summary'),
              load: () => fetchSalesCsv('summary', csvFilters),
            })
          }
        >
          Shop summary CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Reports" value={String(totals.reports)} />
        <Stat label="Installations" value={String(totals.inst)} />
        <Stat label="Demos" value={String(totals.demos)} />
        <Stat label="Received" value={inr(totals.received)} />
        <Stat label="Visits" value={String(totals.visits)} />
        <Stat label="Fuel" value={inr(totals.fuel)} />
      </div>

      <Card className="space-y-3 p-4">
        <div>
          <h2 className="text-sm font-semibold">Collection breakdown</h2>
          <p className="text-xs text-muted">
            Totals by payment mode for the current filters.
          </p>
        </div>
        <div className="space-y-1 text-sm">
          <Row label="Cash" value={inr(totals.cash)} />
          <Row label="Cheque" value={inr(totals.cheque)} />
          <Row label="UPI" value={inr(totals.upi)} />
          <Row label="Total" value={inr(totals.received)} strong />
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <div>
          <h2 className="text-sm font-semibold">Filters</h2>
          <p className="text-xs text-muted">
            Your reporting tree only. Defaults to this month.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Salesman">
            <Select
              value={salesmanId}
              onChange={(event) => setSalesmanId(event.target.value)}
            >
              <option value="all">All in your tree</option>
              {(dash.people ?? []).map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="From">
            <Input
              type="date"
              className="font-mono"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </Field>
          <Field label="To">
            <Input
              type="date"
              className="font-mono"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-8 px-3 text-xs"
            onClick={() => {
              const range = currentMonthRange();
              setFrom(range.from);
              setTo(range.to);
            }}
          >
            This month
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-8 px-3 text-xs"
            onClick={() => {
              setFrom('');
              setTo('');
            }}
          >
            All time
          </Button>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <div>
          <h2 className="text-sm font-semibold">Reports by month</h2>
          <p className="text-xs text-muted">
            Open a month, then a salesman, for the full entries.
          </p>
        </div>
        {months.length === 0 ? (
          <p className="text-sm text-muted">No reports yet for this tree.</p>
        ) : (
          <div className="space-y-2">
            {visibleMonths.map(([key, rows]) => (
              <MonthGroup
                key={key}
                monthKey={key}
                rows={rows}
                expanded={expandedMonth === key}
                openSalesman={expandedMonth === key ? openSalesman : ''}
                onToggle={() => {
                  setExpandedMonth(expandedMonth === key ? null : key);
                  setOpenSalesman('');
                }}
                onSalesman={(name) =>
                  setOpenSalesman((current) => (current === name ? '' : name))
                }
              />
            ))}
            {months.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                className="h-8 px-3 text-xs"
                onClick={() => setShowAllMonths((value) => !value)}
              >
                {showAllMonths
                  ? 'Hide earlier months'
                  : `Show ${months.length - 1} earlier month${months.length - 1 > 1 ? 's' : ''}`}
              </Button>
            ) : null}
          </div>
        )}
      </Card>

      <Card className="space-y-3 p-4">
        <div>
          <h2 className="text-sm font-semibold">Shop summary</h2>
          <p className="text-xs text-muted">
            Shop totals by payment type and GST for one month.
          </p>
        </div>
        {months.length === 0 ? (
          <p className="text-sm text-muted">No reports yet.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Month">
                <Select
                  value={effectiveSummary}
                  onChange={(event) => setSummaryMonth(event.target.value)}
                >
                  {months.map(([key]) => (
                    <option key={key} value={key}>
                      {monthLabel(key)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button
                type="button"
                variant="outline"
                className="h-8 px-3 text-xs"
                disabled={!hasSummary}
                onClick={() =>
                  setCsvSheet({
                    title: 'Shop summary',
                    filename: salesCsvFilename('summary'),
                    load: () =>
                      fetchSalesCsv('summary', {
                        ...monthRangeFromKey(effectiveSummary),
                        salesmanId: salesmanId === 'all' ? undefined : salesmanId,
                      }),
                  })
                }
              >
                Export CSV
              </Button>
            </div>
            {!hasSummary ? (
              <p className="text-sm text-muted">No payments recorded for this month.</p>
            ) : (
              <div className="space-y-4">
                {(['Cash', 'Cheque', 'UPI'] as const).map((mode) =>
                  summary[mode].length ? (
                    <div key={mode}>
                      <p className="mb-1 text-xs font-medium text-muted">{mode}</p>
                      <div className="overflow-x-auto rounded-md border border-line">
                        <table className="w-full text-sm">
                          <tbody>
                            {summary[mode].map((item) => (
                              <tr
                                key={`${item.shop}-${item.gst}`}
                                className="border-b border-line last:border-b-0"
                              >
                                <td className="px-3 py-2">{item.shop}</td>
                                <td className="px-3 py-2 text-right font-mono text-xs">
                                  {inr(item.amount)}
                                </td>
                                <td className="px-3 py-2 text-right text-xs text-muted">
                                  {item.gst}
                                </td>
                              </tr>
                            ))}
                            <tr>
                              <td className="px-3 py-2 font-medium">Subtotal</td>
                              <td className="px-3 py-2 text-right font-mono text-xs">
                                {inr(
                                  summary[mode].reduce(
                                    (sum, item) => sum + item.amount,
                                    0,
                                  ),
                                )}
                              </td>
                              <td />
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null,
                )}
                <div className="flex justify-between text-sm font-medium">
                  <span>Grand total</span>
                  <span className="font-mono text-xs">
                    {inr(
                      [...summary.Cash, ...summary.Cheque, ...summary.UPI].reduce(
                        (sum, item) => sum + item.amount,
                        0,
                      ),
                    )}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-xl font-semibold tracking-tight">{value}</p>
    </Card>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className={`flex justify-between ${strong ? 'font-medium' : ''}`}>
      <span className="text-muted">{label}</span>
      <span className="font-mono text-xs">{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

function MonthGroup({
  monthKey,
  rows,
  expanded,
  openSalesman,
  onToggle,
  onSalesman,
}: {
  monthKey: string;
  rows: SalesDayReport[];
  expanded: boolean;
  openSalesman: string;
  onToggle: () => void;
  onSalesman: (name: string) => void;
}) {
  const t = {
    reports: rows.length,
    inst: rows.reduce((sum, row) => sum + row.instCount, 0),
    demos: rows.reduce((sum, row) => sum + row.demoCount, 0),
    visits: rows.reduce((sum, row) => sum + row.visits, 0),
    received: rows.reduce((sum, row) => sum + row.received, 0),
    fuel: rows.reduce((sum, row) => sum + row.fuel, 0),
  };
  const byName = new Map<
    string,
    {
      reports: number;
      inst: number;
      demos: number;
      visits: number;
      received: number;
      fuel: number;
    }
  >();
  rows.forEach((row) => {
    const name = row.salesmanName || '—';
    const current = byName.get(name) ?? {
      reports: 0,
      inst: 0,
      demos: 0,
      visits: 0,
      received: 0,
      fuel: 0,
    };
    current.reports += 1;
    current.inst += row.instCount;
    current.demos += row.demoCount;
    current.visits += row.visits;
    current.received += row.received;
    current.fuel += row.fuel;
    byName.set(name, current);
  });
  const salesmen = [...byName.entries()].sort((a, b) => b[1].received - a[1].received);
  const detail = openSalesman
    ? rows.filter((row) => (row.salesmanName || '—') === openSalesman)
    : [];

  return (
    <div className="overflow-hidden rounded-md border border-line">
      <button
        type="button"
        className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-line/40"
        onClick={onToggle}
      >
        <span className="font-medium">{monthLabel(monthKey)}</span>
        <span className="text-xs text-muted">
          {t.reports} reports · {t.inst} inst. · {t.demos} demos · {t.visits} visits ·{' '}
          {inr(t.fuel)} fuel · {inr(t.received)}
        </span>
      </button>
      {expanded ? (
        <div className="space-y-3 border-t border-line p-3">
          <p className="text-xs text-muted">By salesman — tap a row for full entries</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-1 font-medium">Salesman</th>
                  <th className="py-1 font-medium">Reports</th>
                  <th className="py-1 font-medium">Inst.</th>
                  <th className="py-1 font-medium">Demos</th>
                  <th className="py-1 font-medium">Received</th>
                  <th className="py-1 font-medium">Visits</th>
                  <th className="py-1 font-medium">Fuel</th>
                </tr>
              </thead>
              <tbody>
                {salesmen.map(([name, stats]) => (
                  <tr
                    key={name}
                    className={`cursor-pointer border-t border-line ${openSalesman === name ? 'bg-sage-soft' : ''}`}
                    onClick={() => onSalesman(name)}
                  >
                    <td className="py-2">{name}</td>
                    <td className="py-2 font-mono text-xs">{stats.reports}</td>
                    <td className="py-2 font-mono text-xs">{stats.inst}</td>
                    <td className="py-2 font-mono text-xs">{stats.demos}</td>
                    <td className="py-2 font-mono text-xs">{inr(stats.received)}</td>
                    <td className="py-2 font-mono text-xs">{stats.visits}</td>
                    <td className="py-2 font-mono text-xs">{inr(stats.fuel)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {openSalesman ? (
            <div className="overflow-x-auto rounded-md border border-line">
              <table className="min-w-[960px] w-full text-left text-xs">
                <thead className="border-b border-line text-muted">
                  <tr>
                    <th className="px-2 py-2 font-medium">Date</th>
                    <th className="px-2 py-2 font-medium">Inst.</th>
                    <th className="px-2 py-2 font-medium">Received</th>
                    <th className="px-2 py-2 font-medium">Shops</th>
                    <th className="px-2 py-2 font-medium">Cash</th>
                    <th className="px-2 py-2 font-medium">Cheque</th>
                    <th className="px-2 py-2 font-medium">UPI</th>
                    <th className="px-2 py-2 font-medium">Visits</th>
                    <th className="px-2 py-2 font-medium">Fuel</th>
                    <th className="px-2 py-2 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.map((row) => (
                    <tr
                      key={`${row.userId}-${row.workDate}`}
                      className="border-b border-line last:border-b-0"
                    >
                      <td className="px-2 py-2 font-mono">{row.workDate}</td>
                      <td className="px-2 py-2 font-mono">{row.instCount}</td>
                      <td className="px-2 py-2 font-mono">{inr(row.received)}</td>
                      <td className="px-2 py-2">
                        {row.recShops || row.visitShops || '—'}
                      </td>
                      <td className="px-2 py-2 font-mono">{inr(row.cash)}</td>
                      <td className="px-2 py-2 font-mono">{inr(row.cheque)}</td>
                      <td className="px-2 py-2 font-mono">{inr(row.upi)}</td>
                      <td className="px-2 py-2 font-mono">{row.visits}</td>
                      <td className="px-2 py-2 font-mono">{inr(row.fuel)}</td>
                      <td className="px-2 py-2 text-muted">
                        {row.updates || row.issues || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
