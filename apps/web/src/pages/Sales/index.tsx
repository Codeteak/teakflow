import { useEffect, useMemo, useState } from 'react';
import { ROLES, SALES_MONTH_TABS, SALES_VISIT_KIND, collectionPeriod, type SalesDashboard, type SalesPaymentsView, type SalesShop } from '@teakflow/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormModal } from '@/components/ui/form-modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getSalesDashboardRequest,
  getSalesDayRequest,
  getSalesPaymentsRequest,
  patchSalesPaymentRequest,
  saveSalesDayRequest,
  fetchSalesCsv,
  fetchShopTemplateCsv,
  salesCsvFilename,
  upsertShopsRequest,
  updateShopRequest,
  deleteShopRequest,
} from '@/features/sales/api';
import { CsvSheetPreview, type CsvSheetSource } from '@/features/sales/CsvSheetPreview';
import { canManageShops, canSeeFullCollection } from '@/features/sales/RequireSales';
import { TeamReports } from '@/features/sales/TeamReports';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';

type VisitRow = {
  key: string;
  shopId: string;
  shopName: string;
  place: string;
  listed: boolean;
  kind: string;
  count: number;
  notes: string;
};

type ReceivedRow = {
  key: string;
  shopId: string;
  shopName: string;
  amount: string;
  gst: 'GST' | 'Non-GST';
  ref: string;
  mode: 'Cash' | 'Cheque' | 'UPI';
  bankName: string;
  month: string;
  year: number;
  sheetRow: number | null;
};

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

type SalesForm = 'visit' | 'received' | 'fuel' | 'pay' | 'shop' | 'bulk' | null;

export function SalesPage() {
  const user = useAuthStore((state) => state.user);
  const isExec = user?.role === ROLES.EMPLOYEE;
  const manageShops = canManageShops(user);
  const fullCollection = canSeeFullCollection(user);
  const [tab, setTab] = useState<'day' | 'team' | 'pay' | 'shops'>(isExec ? 'day' : 'team');
  const [shops, setShops] = useState<SalesShop[]>([]);
  const [savedVisits, setSavedVisits] = useState<VisitRow[]>([]);
  const [visit, setVisit] = useState<VisitRow>(blankVisit());
  const [savedReceived, setSavedReceived] = useState<ReceivedRow[]>([]);
  const [received, setReceived] = useState<ReceivedRow>(blankReceived());
  const [fuel, setFuel] = useState('0');
  const [fuelLocked, setFuelLocked] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [dash, setDash] = useState<SalesDashboard | null>(null);
  const [pay, setPay] = useState<SalesPaymentsView | null>(null);
  const [payError, setPayError] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [payQuery, setPayQuery] = useState('');
  const [selectedPay, setSelectedPay] = useState<SalesPaymentsView['rows'][number] | null>(null);
  const [shopId, setShopId] = useState('');
  const [shopName, setShopName] = useState('');
  const [shopPlace, setShopPlace] = useState('');
  const [shopCsv, setShopCsv] = useState('');
  const [shopMsg, setShopMsg] = useState('');
  const [pendingBulk, setPendingBulk] = useState<{ csv: string; created: number; updated: number; count: number; errors: string[] } | null>(null);
  const [csvSheet, setCsvSheet] = useState<CsvSheetSource | null>(null);
  const [editingShopId, setEditingShopId] = useState('');
  const [form, setForm] = useState<SalesForm>(null);
  const [dayReady, setDayReady] = useState(false);
  const [teamReady, setTeamReady] = useState(isExec);
  const salesDayVersion = useToastStore((state) => state.salesDayVersion);
  const salesPayVersion = useToastStore((state) => state.salesPayVersion);

  useEffect(() => {
    setDayReady(false);
    void getSalesDayRequest()
      .then((data) => applyDay(data))
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Unable to load sales.'))
      .finally(() => setDayReady(true));
    if (!isExec) {
      setTeamReady(false);
      void getSalesDashboardRequest()
        .then(setDash)
        .catch(() => undefined)
        .finally(() => setTeamReady(true));
    } else {
      setTeamReady(true);
    }
    setPayLoading(true);
    getSalesPaymentsRequest()
      .then((data) => {
        setPay(data);
        setPayError('');
        setSelectedPay((current) => {
          if (!current) {
            return null;
          }
          return data.rows.find((row) => row.shopId === current.shopId || row.shopName === current.shopName) ?? current;
        });
      })
      .catch((cause) => setPayError(cause instanceof Error ? cause.message : 'Unable to load collection shops.'))
      .finally(() => setPayLoading(false));
  }, [isExec]);

  useEffect(() => {
    if (salesDayVersion === 0) {
      return;
    }
    void getSalesDayRequest()
      .then((data) => applyDay(data))
      .catch(() => undefined);
  }, [salesDayVersion]);

  useEffect(() => {
    if (salesPayVersion === 0) {
      return;
    }
    void getSalesPaymentsRequest(pay?.month, pay?.year, true)
      .then((data) => {
        setPay(data);
        setSelectedPay((current) =>
          current
            ? data.rows.find((row) => row.shopId === current.shopId || row.shopName === current.shopName) ?? null
            : null,
        );
      })
      .catch(() => undefined);
  }, [salesPayVersion]);

  const period = useMemo(() => collectionPeriod(new Date(), 'Asia/Kolkata'), []);
  const receivedTotal = savedReceived.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

  function applyDay(data: Awaited<ReturnType<typeof getSalesDayRequest>>) {
    setShops(data.shops);
    setSavedVisits(
      data.visits.map((item) => ({
        key: item.id,
        shopId: item.shopId ?? '',
        shopName: item.shopName,
        place: item.place,
        listed: item.listed,
        kind: item.kind,
        count: item.count,
        notes: item.notes,
      })),
    );
    setSavedReceived(
      data.received.map((row) => ({
        key: row.id,
        shopId: row.shopId ?? '',
        shopName: row.shopName,
        amount: String(row.amount),
        gst: row.gst === 'Non-GST' ? 'Non-GST' : 'GST',
        ref: row.ref,
        mode: row.mode === 'Cheque' || row.mode === 'UPI' ? row.mode : 'Cash',
        bankName: row.bankName,
        month: '',
        year: 0,
        sheetRow: null,
      })),
    );
    if (data.report) {
      setFuel(String(data.report.fuel));
      setFuelLocked(Boolean(data.report.fuelLocked) || data.report.fuel > 0);
    } else {
      setFuelLocked(false);
    }
  }

  function saveVisit() {
    setError('');
    setSaved('');
    if (!visit.shopName.trim()) {
      setError('Pick a shop for this visit.');
      return;
    }
    const payload = {
      shopId: visit.listed ? visit.shopId : null,
      shopName: visit.shopName,
      place: visit.place,
      kind: visit.kind,
      count: Number(visit.count) || 1,
      notes: visit.notes,
    };
    const toast = useToastStore.getState();
    const toastId = toast.showProgress('Saving visit…', payload.shopName);
    setForm(null);
    setVisit(blankVisit());
    void saveSalesDayRequest({ section: 'visit', visit: payload })
      .then(() => {
        toast.bumpSalesDay();
        toast.resolve(
          toastId,
          'success',
          'Visit saved',
          'Notes went on today’s daily work notebook.',
        );
      })
      .catch((cause) => {
        toast.resolve(
          toastId,
          'error',
          'Unable to save visit',
          cause instanceof Error ? cause.message : 'Try again from Sales.',
        );
      });
  }

  function saveReceived() {
    setError('');
    setSaved('');
    if (!received.shopName.trim() || !(Number(received.amount) > 0)) {
      setError('Add a shop and amount for this payment.');
      return;
    }
    const payload = {
      shopId: received.shopId || null,
      shopName: received.shopName,
      amount: Number(received.amount),
      gst: received.gst,
      ref: received.ref,
      mode: received.mode,
      bankName: received.bankName,
      month: received.month || period.tab,
      year: received.year || period.year,
      sheetRow: received.sheetRow ?? undefined,
    };
    const toast = useToastStore.getState();
    const toastId = toast.showProgress('Saving payment…', payload.shopName);
    setForm(null);
    setReceived(blankReceived());
    void saveSalesDayRequest({ section: 'received', received: payload })
      .then(() => {
        toast.bumpSalesDay();
        toast.bumpSalesPay();
        toast.resolve(toastId, 'success', 'Payment saved', 'Today’s report and the month sheet were updated.');
      })
      .catch((cause) => {
        toast.resolve(
          toastId,
          'error',
          'Unable to save payment',
          cause instanceof Error ? cause.message : 'Try again from Sales.',
        );
      });
  }

  function saveFuel() {
    setError('');
    setSaved('');
    if (fuelLocked) {
      setError('Fuel is already saved for today.');
      return;
    }
    const amount = Number(fuel) || 0;
    if (!(amount > 0)) {
      setError('Add today’s fuel amount.');
      return;
    }
    const toast = useToastStore.getState();
    const toastId = toast.showProgress('Saving fuel…', `₹${amount}`);
    setForm(null);
    void saveSalesDayRequest({ section: 'fuel', fuel: amount })
      .then(() => {
        toast.bumpSalesDay();
        toast.resolve(toastId, 'success', 'Fuel saved', 'Today’s fuel is locked. One entry per work date.');
      })
      .catch((cause) => {
        toast.resolve(
          toastId,
          'error',
          'Unable to save fuel',
          cause instanceof Error ? cause.message : 'Try again from Sales.',
        );
      });
  }

  function savePay(row: SalesPaymentsView['rows'][number], status: string, paymentMode: string, reference: string, date: string) {
    setPayError('');
    const toast = useToastStore.getState();
    const toastId = toast.showProgress('Updating sheet…', row.shopName || row.shopId);
    setForm(null);
    void patchSalesPaymentRequest({
      year: pay?.year,
      month: pay?.month,
      shopId: row.shopId || row.shopName,
      sheetRow: row.sheetRow,
      status,
      paymentMode,
      date,
      reference,
    })
      .then(() => {
        toast.bumpSalesPay();
        toast.resolve(toastId, 'success', 'Sheet updated', 'STATUS, mode, date, and reference were written to Drive.');
      })
      .catch((cause) => {
        toast.resolve(
          toastId,
          'error',
          'Unable to update sheet',
          cause instanceof Error ? cause.message : 'Try again from Collection.',
        );
      });
  }

  function addOneShop() {
    setShopMsg('');
    if (!shopName.trim() || (!editingShopId && !shopId.trim())) {
      setShopMsg('Add ID and shop name.');
      return;
    }
    const toast = useToastStore.getState();
    const toastId = toast.showProgress(editingShopId ? 'Updating shop…' : 'Saving shop…', shopName);
    const editing = editingShopId;
    const payload = { shopId, name: shopName, place: shopPlace };
    setForm(null);
    setEditingShopId('');
    setShopId('');
    setShopName('');
    setShopPlace('');
    const request = editing
      ? updateShopRequest(editing, { name: payload.name, place: payload.place })
      : upsertShopsRequest({ shops: [{ shopId: payload.shopId, name: payload.name, place: payload.place }], confirm: true });
    void request
      .then((data) => {
        setShops(data.shops);
        toast.resolve(
          toastId,
          'success',
          editing ? 'Shop updated' : 'Shop saved',
          `${data.shops.length} shops in the directory.`,
        );
      })
      .catch((cause) => {
        toast.resolve(
          toastId,
          'error',
          'Unable to save shop',
          cause instanceof Error ? cause.message : 'Try again from Shops.',
        );
      });
  }

  async function importShopSheet(file?: File | null) {
    setShopMsg('');
    try {
      const csv = file ? await file.text() : shopCsv;
      const data = await upsertShopsRequest({ csv, confirm: false });
      setPendingBulk({
        csv,
        created: data.created,
        updated: data.updated,
        count: data.shops.length,
        errors: data.errors ?? [],
      });
      setShopMsg(`Preview: ${data.created} new, ${data.updated} already in the list (will update name/place). Confirm to apply.`);
    } catch (cause) {
      setShopMsg(cause instanceof Error ? cause.message : 'Unable to import.');
    }
  }

  function confirmBulk() {
    if (!pendingBulk) {
      return;
    }
    const toast = useToastStore.getState();
    const toastId = toast.showProgress('Importing shops…', `${pendingBulk.count} rows`);
    const csv = pendingBulk.csv;
    setForm(null);
    setPendingBulk(null);
    setShopCsv('');
    void upsertShopsRequest({ csv, confirm: true })
      .then((data) => {
        setShops(data.shops);
        toast.resolve(toastId, 'success', 'Shops imported', `${data.created} new, ${data.updated} updated.`);
      })
      .catch((cause) => {
        toast.resolve(
          toastId,
          'error',
          'Unable to import shops',
          cause instanceof Error ? cause.message : 'Try again from Shops.',
        );
      });
  }

  async function removeDirectoryShop(id: string, name: string) {
    if (!window.confirm(`Delete ${name} (${id}) from the directory? Visits already saved stay in history.`)) {
      return;
    }
    setShopMsg('');
    try {
      const data = await deleteShopRequest(id);
      setShops(data.shops);
      if (editingShopId === id) {
        setEditingShopId('');
        setShopId('');
        setShopName('');
        setShopPlace('');
      }
      setShopMsg('Shop deleted from the directory.');
    } catch (cause) {
      setShopMsg(cause instanceof Error ? cause.message : 'Unable to delete.');
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-5">
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Sales</h1>
          <p className="mt-1 text-sm text-muted">
            Collecting {period.tab} {period.year} this month ({period.fileName}).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={chip(tab === 'day')} onClick={() => setTab('day')}>
            Today
          </button>
          {!isExec ? (
            <button type="button" className={chip(tab === 'team')} onClick={() => setTab('team')}>
              Team
            </button>
          ) : null}
          <button type="button" className={chip(tab === 'pay')} onClick={() => setTab('pay')}>
            Collection
          </button>
          {manageShops ? (
            <button type="button" className={chip(tab === 'shops')} onClick={() => setTab('shops')}>
              Shops
            </button>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {tab === 'day' ? (
        !dayReady ? (
          <SalesDaySkeleton />
        ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-5">
          {error && form === null ? <p className="text-sm text-rose">{error}</p> : null}
          {saved && form === null ? <p className="text-sm text-sage">{saved}</p> : null}
          {dayReady && shops.length === 0 ? (
            <p className="text-sm text-muted">
              No shops in the directory yet. {manageShops ? 'Open the Shops tab to add one or upload the example sheet.' : 'Ask a manager or lead to add shops, or mark the visit as not in our list.'}
            </p>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ActionCard
              title="Store visit"
              detail={`${savedVisits.length} saved today. One shop at a time, then the notebook.`}
              action="Add visit"
              icon="/3d-icons/shop.png"
              onOpen={() => {
                setError('');
                setSaved('');
                setForm('visit');
              }}
            />
            <ActionCard
              title="Received"
              detail={`${inr(receivedTotal)} today. Save one payment at a time.`}
              action="Add payment"
              icon="/3d-icons/money.png"
              onOpen={() => {
                setError('');
                setSaved('');
                setForm('received');
              }}
            />
            <ActionCard
              title="Fuel"
              detail={
                fuelLocked
                  ? `${inr(fuel)} saved today. One fuel entry per work date.`
                  : 'Save today’s fuel once. After that it cannot be changed.'
              }
              action={fuelLocked ? 'Saved today' : 'Add fuel'}
              icon="/3d-icons/fuel.png"
              locked={fuelLocked}
              onOpen={() => {
                if (fuelLocked) {
                  return;
                }
                setError('');
                setSaved('');
                setFuel('');
                setForm('fuel');
              }}
            />
          </div>
          {savedVisits.length ? (
            <div className="divide-y divide-line rounded-lg border border-line bg-surface">
              {savedVisits.map((row) => (
                <div key={row.key} className="px-4 py-2 text-sm">
                  <p className="font-medium">
                    {row.shopName}
                    {row.shopId ? <span className="font-mono text-xs text-muted"> · {row.shopId}</span> : null}
                  </p>
                  <p className="text-muted">
                    {row.kind}
                    {row.place ? ` · ${row.place}` : ''}
                    {row.notes ? ` · ${row.notes}` : ''}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
          {savedReceived.length ? (
            <div className="divide-y divide-line rounded-lg border border-line bg-surface">
              {savedReceived.map((row) => (
                <div key={row.key} className="px-4 py-2 text-sm">
                  <p className="font-medium">
                    {row.shopName} · {inr(row.amount)} · {row.mode}
                  </p>
                  <p className="text-muted">{row.gst}{row.ref ? ` · ${row.ref}` : ''}</p>
                </div>
              ))}
            </div>
          ) : null}
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setCsvSheet({
                  title: 'Daily report',
                  filename: salesCsvFilename('export'),
                  load: () => fetchSalesCsv('export'),
                })
              }
            >
              Download this report (CSV)
            </Button>
          </div>
        </div>
        )
      ) : null}

      {tab === 'team' && !isExec ? (
        !teamReady ? (
          <SalesTeamSkeleton />
        ) : dash ? (
        <TeamReports
          dash={dash}
          onRefresh={() => {
            setTeamReady(false);
            void getSalesDashboardRequest()
              .then(setDash)
              .catch(() => undefined)
              .finally(() => setTeamReady(true));
          }}
        />
        ) : (
          <p className="text-sm text-muted">No team reports yet.</p>
        )
      ) : null}

      {tab === 'pay' ? (
        <div className="space-y-3">
          {payError ? <p className="text-sm text-rose">{payError}</p> : null}
          {payLoading && !pay ? <SalesPaySkeleton /> : null}
          {payLoading && pay ? <p className="text-sm text-muted">Refreshing workbook…</p> : null}
          {pay ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <ActionCard
                  title="Update collection"
                  detail={`Excel for ${pay.tabTitle || pay.month} ${pay.year}. STATUS, PAYMENT MODE, DATE, REFERNCE NO only.`}
                  action="Open form"
                  icon="/3d-icons/money.png"
                  onOpen={() => setForm('pay')}
                />
                <Card className="flex flex-col justify-between gap-3 rounded-xl p-4">
                  <div>
                    <h2 className="text-sm font-semibold">Month tab</h2>
                    <p className="mt-0.5 text-xs leading-5 text-muted">Workbook month for this collection period.</p>
                  </div>
                  <Select
                    value={pay.month}
                    onChange={(event) => {
                      setPayLoading(true);
                      void getSalesPaymentsRequest(event.target.value, pay.year)
                        .then((data) => {
                          setPay(data);
                          setPayError('');
                          setSelectedPay(null);
                          setPayQuery('');
                        })
                        .catch((cause) => setPayError(cause instanceof Error ? cause.message : 'Unable to load.'))
                        .finally(() => setPayLoading(false));
                    }}
                  >
                    {(pay.tabs?.length ? pay.tabs : SALES_MONTH_TABS).map((month) => (
                      <option key={month} value={month.toLowerCase()}>
                        {month}
                      </option>
                    ))}
                  </Select>
                </Card>
                <Card className="flex flex-col justify-between gap-3 rounded-xl p-4">
                  <div>
                    <h2 className="text-sm font-semibold">Drive</h2>
                    <p className="mt-0.5 text-xs leading-5 text-muted">Reload shops and amounts from the yearly workbook.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 self-start px-3 text-xs"
                    onClick={() => {
                      setPayLoading(true);
                      void getSalesPaymentsRequest(pay.month, pay.year, true)
                        .then((data) => {
                          setPay(data);
                          setSelectedPay((current) =>
                            current
                              ? data.rows.find((row) => row.shopId === current.shopId || row.shopName === current.shopName) ?? null
                              : null,
                          );
                        })
                        .catch((cause) => setPayError(cause instanceof Error ? cause.message : 'Unable to load.'))
                        .finally(() => setPayLoading(false));
                    }}
                  >
                    Refresh from Drive
                  </Button>
                </Card>
              </div>
              {fullCollection ? (
              <div className="overflow-x-auto rounded-lg border border-line bg-surface">
                <table className="min-w-[1100px] w-full text-left text-sm">
                  <thead className="border-b border-line text-xs text-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">Shop ID</th>
                      <th className="px-3 py-2 font-medium">Shop name</th>
                      <th className="px-3 py-2 font-medium">Place</th>
                      <th className="px-3 py-2 font-medium">Amount (₹)</th>
                      <th className="px-3 py-2 font-medium">GST</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Mode of payment</th>
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Reference no.</th>
                      <th className="px-3 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {pay.rows.map((row) => (
                        <PaymentEditor
                          key={`${row.sheetRow}-${row.shopId}`}
                          row={row}
                          statusOptions={pay.statusOptions}
                          modeOptions={pay.modeOptions}
                          showAccounts
                          onSave={savePay}
                        />
                      ))}
                  </tbody>
                </table>
              </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {tab === 'shops' && manageShops ? (
        !dayReady ? (
          <SalesShopsSkeleton />
        ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {shops.length} shops. Same ID updates the name and place. Executives cannot add to this list.
          </p>
          {shopMsg && form === null ? <p className="text-sm text-sage">{shopMsg}</p> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <ActionCard
              title="Add shop"
              detail="One directory row: ID, name, and place."
              action={editingShopId ? 'Continue edit' : 'Add shop'}
              icon="/3d-icons/shop.png"
              onOpen={() => setForm('shop')}
            />
            <ActionCard
              title="Import sheet"
              detail="Headers ID, SHOP NAME, PLACE. Preview, then confirm."
              action="Open import"
              icon="/3d-icons/shop.png"
              onOpen={() => setForm('bulk')}
            />
          </div>
          <div className="divide-y divide-line rounded-lg border border-line bg-surface">
            {shops.map((shop) => (
              <div key={shop.shopId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                <p>
                  <span className="font-mono text-xs">{shop.shopId}</span>
                  {' · '}
                  {shop.name}
                  {shop.place ? <span className="text-muted"> · {shop.place}</span> : null}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 px-2 text-xs"
                    onClick={() => {
                      setEditingShopId(shop.shopId);
                      setShopId(shop.shopId);
                      setShopName(shop.name);
                      setShopPlace(shop.place);
                      setForm('shop');
                    }}
                  >
                    Edit
                  </Button>
                  <Button type="button" variant="ghost" className="h-8 px-2 text-xs text-rose" onClick={() => void removeDirectoryShop(shop.shopId, shop.name)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
        )
      ) : null}
      </div>

      <FormModal
        open={form === 'visit'}
        title="Store visit"
        description="Save one shop. Notes go on today’s daily work notebook."
        onClose={() => setForm(null)}
        footer={
          <Button type="button" className="w-full" onClick={() => saveVisit()}>
            Save this visit
          </Button>
        }
      >
        <div className="space-y-3">
          {error ? <p className="text-sm text-rose">{error}</p> : null}
          {saved ? <p className="text-sm text-sage">{saved}</p> : null}
          <ShopFields shops={shops} row={visit} onChange={setVisit} />
          <Field label="Type">
            <Select value={visit.kind} onChange={(event) => setVisit((current) => ({ ...current, kind: event.target.value }))}>
              <option value={SALES_VISIT_KIND.VISIT}>Store visit</option>
              <option value={SALES_VISIT_KIND.DEMO}>Demo shown</option>
              <option value={SALES_VISIT_KIND.INSTALLATION}>Installation</option>
            </Select>
          </Field>
          <Field label={countLabel(visit.kind)}>
            <Input
              type="number"
              min={0}
              value={visit.count}
              onChange={(event) => setVisit((current) => ({ ...current, count: Number(event.target.value) }))}
            />
          </Field>
          <Field label="Notes">
            <textarea
              className="min-h-24 w-full rounded-md border border-line bg-surface p-3 text-sm"
              placeholder="Issues, updates, or anything from this shop"
              value={visit.notes}
              onChange={(event) => setVisit((current) => ({ ...current, notes: event.target.value }))}
            />
          </Field>
        </div>
      </FormModal>

      <FormModal
        open={form === 'received'}
        title="Payment received"
        description="Pick the month sheet, then a shop. Save one payment at a time. Excel collection stays separate."
        onClose={() => setForm(null)}
        footer={
          <Button type="button" className="w-full" onClick={() => saveReceived()}>
            Save this payment
          </Button>
        }
      >
        <div className="space-y-3">
          {error ? <p className="text-sm text-rose">{error}</p> : null}
          {saved ? <p className="text-sm text-sage">{saved}</p> : null}
          <ReceivedFields shops={shops} pay={pay} row={received} onChange={setReceived} />
        </div>
      </FormModal>

      <FormModal
        open={form === 'fuel'}
        title="Fuel"
        description="One fuel amount per work date. After save it is locked for today."
        onClose={() => setForm(null)}
        footer={
          <Button type="button" className="w-full" disabled={fuelLocked} onClick={() => saveFuel()}>
            Save fuel
          </Button>
        }
      >
        <div className="space-y-3">
          {error ? <p className="text-sm text-rose">{error}</p> : null}
          {saved ? <p className="text-sm text-sage">{saved}</p> : null}
          <Field label="Fuel (₹)">
            <Input type="number" min={0} placeholder="0" value={fuel} onChange={(event) => setFuel(event.target.value)} />
          </Field>
        </div>
      </FormModal>

      <FormModal
        open={form === 'pay' && Boolean(pay)}
        title="Collection payment"
        description="Pick a shop, then write STATUS, PAYMENT MODE, DATE, and REFERNCE NO."
        onClose={() => setForm(null)}
      >
        {pay ? (
          <div className="space-y-3">
            {payError ? <p className="text-sm text-rose">{payError}</p> : null}
            <Field label="Store name or ID">
              <Input
                placeholder="Search Excel shop ID, name, or place"
                value={payQuery}
                onChange={(event) => setPayQuery(event.target.value)}
              />
            </Field>
            {pay.rows.length > 0 ? (
              <div className="max-h-40 overflow-auto rounded-md border border-line">
                {pay.rows
                  .filter((row) => {
                    const needle = payQuery.trim().toLowerCase();
                    if (!needle) {
                      return true;
                    }
                    return `${row.shopId} ${row.shopName} ${row.place}`.toLowerCase().includes(needle);
                  })
                  .slice(0, 40)
                  .map((row) => (
                    <button
                      key={`${row.sheetRow}-${row.shopId}`}
                      type="button"
                      className={`block w-full px-3 py-2 text-left text-sm hover:bg-line/40 ${selectedPay?.sheetRow === row.sheetRow ? 'bg-sage-soft' : ''}`}
                      onClick={() => {
                        setSelectedPay(row);
                        setPayQuery(`${row.shopId} ${row.shopName}`.trim());
                      }}
                    >
                      <span className="font-mono text-xs">{row.shopId || '—'}</span>
                      {' · '}
                      {row.shopName}
                      {row.place ? <span className="text-muted"> · {row.place}</span> : null}
                    </button>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-muted">No shop rows on this month tab.</p>
            )}
            {selectedPay ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Shop ID">
                    <p className="font-mono text-sm">{selectedPay.shopId || '—'}</p>
                  </Field>
                  <Field label="SHOP NAME">
                    <p className="text-sm">{selectedPay.shopName || '—'}</p>
                  </Field>
                  <Field label="PLACE">
                    <p className="text-sm">{selectedPay.place || '—'}</p>
                  </Field>
                  <Field label="AMOUNT">
                    <p className="text-sm">{inr(selectedPay.amount)}</p>
                  </Field>
                  <Field label="GST">
                    <p className="text-sm">{selectedPay.gst || '—'}</p>
                  </Field>
                </div>
                <PaymentFields
                  row={selectedPay}
                  statusOptions={pay.statusOptions}
                  modeOptions={pay.modeOptions}
                  onSave={savePay}
                />
              </>
            ) : (
              <p className="text-sm text-muted">Select a shop to load Excel details.</p>
            )}
          </div>
        ) : null}
      </FormModal>

      <FormModal
        open={form === 'shop'}
        title={editingShopId ? 'Update shop' : 'Add shop'}
        description="Directory shops only. Visits already saved stay in history."
        onClose={() => setForm(null)}
        footer={
          <div className="flex gap-2">
            {editingShopId ? (
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setEditingShopId('');
                  setShopId('');
                  setShopName('');
                  setShopPlace('');
                }}
              >
                Cancel edit
              </Button>
            ) : null}
            <Button type="button" className="flex-1" onClick={() => addOneShop()}>
              {editingShopId ? 'Update shop' : 'Save shop'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {shopMsg ? <p className="text-sm text-sage">{shopMsg}</p> : null}
          <Field label="ID">
            <Input placeholder="ID" value={shopId} onChange={(event) => setShopId(event.target.value)} disabled={Boolean(editingShopId)} />
          </Field>
          <Field label="SHOP NAME">
            <Input placeholder="SHOP NAME" value={shopName} onChange={(event) => setShopName(event.target.value)} />
          </Field>
          <Field label="PLACE">
            <Input placeholder="PLACE" value={shopPlace} onChange={(event) => setShopPlace(event.target.value)} />
          </Field>
        </div>
      </FormModal>

      <FormModal
        open={form === 'bulk'}
        title="Import shops"
        description="Headers: ID, SHOP NAME, PLACE. Extra columns are ignored."
        onClose={() => setForm(null)}
      >
        <div className="space-y-3">
          {shopMsg ? <p className="text-sm text-sage">{shopMsg}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setCsvSheet({
                  title: 'Shop example',
                  filename: 'teakflow-shops-example.csv',
                  load: () => fetchShopTemplateCsv(),
                })
              }
            >
              Download example CSV
            </Button>
            <label className="inline-flex h-10 cursor-pointer items-center rounded-md border border-line px-4 text-sm">
              Upload CSV
              <input
                type="file"
                accept=".csv,text/csv,text/tab-separated-values,.tsv"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  void importShopSheet(file);
                }}
              />
            </label>
          </div>
          <textarea
            className="min-h-32 w-full rounded-md border border-line bg-surface p-3 font-mono text-xs"
            placeholder={'ID,SHOP NAME,PLACE\n100022,Families Hypermart Chikkabasavanapura,K R Puram'}
            value={shopCsv}
            onChange={(event) => setShopCsv(event.target.value)}
          />
          <Button type="button" variant="outline" onClick={() => void importShopSheet()}>
            Preview pasted rows
          </Button>
          {pendingBulk ? (
            <div className="space-y-2 rounded-md border border-line p-3">
              <p className="text-sm">
                {pendingBulk.count} rows · {pendingBulk.created} new · {pendingBulk.updated} updates
              </p>
              {pendingBulk.errors.length ? <p className="text-xs text-rose">{pendingBulk.errors.join(' ')}</p> : null}
              <div className="flex gap-2">
                <Button type="button" onClick={() => void confirmBulk()}>
                  Confirm upsert
                </Button>
                <Button type="button" variant="outline" onClick={() => setPendingBulk(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </FormModal>
      <CsvSheetPreview source={csvSheet} onClose={() => setCsvSheet(null)} />
    </div>
  );
}

function chip(active: boolean) {
  return `h-8 rounded-md border px-3 text-xs font-medium ${active ? 'border-sage bg-sage-soft text-sage' : 'border-line bg-surface text-muted'}`;
}

function ActionCard({
  title,
  detail,
  action,
  icon,
  locked = false,
  onOpen,
}: {
  title: string;
  detail: string;
  action: string;
  icon?: string;
  locked?: boolean;
  onOpen: () => void;
}) {
  return (
    <Card className="flex items-center gap-3 overflow-hidden rounded-xl p-4">
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 self-stretch">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          <p className="mt-0.5 text-xs leading-5 text-muted">{detail}</p>
        </div>
        <Button type="button" className="h-8 self-start px-3 text-xs" disabled={locked} onClick={onOpen}>
          {action}
        </Button>
      </div>
      {icon ? (
        <img
          src={icon}
          alt=""
          aria-hidden
          className="pointer-events-none h-20 w-20 shrink-0 object-contain sm:h-[5.25rem] sm:w-[5.25rem]"
        />
      ) : null}
    </Card>
  );
}

function ActionCardSkeleton() {
  return (
    <Card className="flex items-center gap-3 overflow-hidden rounded-xl p-4">
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 self-stretch">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/5" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
      <Skeleton className="h-20 w-20 shrink-0 rounded-lg sm:h-[5.25rem] sm:w-[5.25rem]" />
    </Card>
  );
}

function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line rounded-lg border border-line bg-surface">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="space-y-2 px-4 py-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
      ))}
    </div>
  );
}

function SalesDaySkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading sales">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ActionCardSkeleton />
        <ActionCardSkeleton />
        <ActionCardSkeleton />
      </div>
      <ListSkeleton />
    </div>
  );
}

function SalesTeamSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading team sales">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <Card key={index} className="space-y-3 p-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-20" />
          </Card>
        ))}
      </div>
      <ListSkeleton rows={5} />
    </div>
  );
}

function SalesPaySkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading collection">
      <div className="grid gap-3 sm:grid-cols-3">
        <ActionCardSkeleton />
        <ActionCardSkeleton />
        <ActionCardSkeleton />
      </div>
      <ListSkeleton rows={6} />
    </div>
  );
}

function SalesShopsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading shops">
      <Skeleton className="h-4 w-64" />
      <div className="grid gap-3 sm:grid-cols-2">
        <ActionCardSkeleton />
        <ActionCardSkeleton />
      </div>
      <ListSkeleton rows={6} />
    </div>
  );
}

function inr(value: number | string) {
  const n = Number(String(value).replace(/,/g, ''));
  if (!Number.isFinite(n) || String(value).trim() === '') {
    return String(value || '—');
  }
  return `₹${n.toLocaleString('en-IN')}`;
}

function countLabel(kind: string) {
  if (kind === SALES_VISIT_KIND.INSTALLATION) {
    return 'Inst.';
  }
  if (kind === SALES_VISIT_KIND.DEMO) {
    return 'Demo';
  }
  return 'Visits';
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted">{label}</p>
      {children}
    </div>
  );
}

function blankVisit(): VisitRow {
  return { key: uid(), shopId: '', shopName: '', place: '', listed: true, kind: SALES_VISIT_KIND.VISIT, count: 1, notes: '' };
}

function blankReceived(): ReceivedRow {
  return {
    key: uid(),
    shopId: '',
    shopName: '',
    amount: '',
    gst: 'GST',
    ref: '',
    mode: 'Cash',
    bankName: '',
    month: '',
    year: 0,
    sheetRow: null,
  };
}

function applyExcelShop(
  row: ReceivedRow,
  excel: SalesPaymentsView['rows'][number] | undefined,
  shopId: string,
  shopName: string,
): ReceivedRow {
  if (!excel) {
    return { ...row, shopId, shopName };
  }
  const gstRaw = excel.gst.trim().toLowerCase();
  const gst: ReceivedRow['gst'] = gstRaw === 'non-gst' || gstRaw === 'no' || gstRaw === 'non gst' ? 'Non-GST' : 'GST';
  const modeRaw = excel.paymentMode.toLowerCase();
  const mode: ReceivedRow['mode'] = modeRaw.includes('cheque') ? 'Cheque' : modeRaw.includes('upi') || modeRaw.includes('online') ? 'UPI' : 'Cash';
  return {
    ...row,
    shopId: excel.shopId || shopId,
    shopName: excel.shopName || shopName,
    amount: excel.amount.replace(/[^\d.]/g, '') || row.amount,
    gst,
    ref: excel.reference || row.ref,
    mode,
    sheetRow: excel.sheetRow,
  };
}

function PaymentFields({
  row,
  statusOptions,
  modeOptions,
  onSave,
}: {
  row: SalesPaymentsView['rows'][number];
  statusOptions: string[];
  modeOptions: string[];
  onSave: (row: SalesPaymentsView['rows'][number], status: string, mode: string, reference: string, date: string) => void;
}) {
  const [status, setStatus] = useState(row.status);
  const [mode, setMode] = useState(row.paymentMode);
  const [reference, setReference] = useState(row.reference);
  const [date, setDate] = useState(row.date);
  useEffect(() => {
    setStatus(row.status);
    setMode(row.paymentMode);
    setReference(row.reference);
    setDate(row.date);
  }, [row.status, row.paymentMode, row.reference, row.date, row.shopId, row.sheetRow]);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="STATUS">
        <Select value={status} onChange={(event) => setStatus(event.target.value)}>
          {[status, ...statusOptions.filter((item) => item !== status), 'PAID', 'PENDING'].filter((item, index, all) => item && all.indexOf(item) === index).map((item) => (
            <option key={item}>{item}</option>
          ))}
        </Select>
      </Field>
      <Field label="PAYMENT MODE">
        <Select value={mode} onChange={(event) => setMode(event.target.value)}>
          {[mode, ...modeOptions.filter((item) => item !== mode), 'Cash', 'Cheque', 'UPI'].filter((item, index, all) => item && all.indexOf(item) === index).map((item) => (
            <option key={item}>{item}</option>
          ))}
        </Select>
      </Field>
      <Field label="DATE">
        <Input value={date} placeholder="DATE" onChange={(event) => setDate(event.target.value)} />
      </Field>
      <Field label="REFERNCE NO">
        <Input value={reference} placeholder="REFERNCE NO" onChange={(event) => setReference(event.target.value)} />
      </Field>
      <Button type="button" disabled={!row.shopId && !row.shopName} onClick={() => onSave(row, status, mode, reference, date)}>
        Save to Excel
      </Button>
    </div>
  );
}

function ShopFields({
  shops,
  row,
  onChange,
}: {
  shops: SalesShop[];
  row: VisitRow;
  onChange: (row: VisitRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const query = row.shopName;
  const needle = query.trim().toLowerCase();
  const matches = shops
    .filter((shop) => {
      const haystack = `${shop.shopId} ${shop.name} ${shop.place}`.toLowerCase();
      return !needle || haystack.includes(needle);
    })
    .slice(0, 40);
  return (
    <div className="space-y-2">
      <Field label="Store name or ID">
      <Input
        placeholder="Shop name or ID"
        value={query}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onChange={(event) => {
          const value = event.target.value;
          const hit = shops.find((shop) => shop.shopId === value || shop.name.toLowerCase() === value.trim().toLowerCase());
          if (hit) {
            onChange({ ...row, shopId: hit.shopId, shopName: hit.name, place: hit.place, listed: true });
            return;
          }
          onChange({ ...row, shopName: value, listed: false, shopId: '' });
        }}
      />
      </Field>
      {open && matches.length > 0 ? (
        <div className="max-h-40 overflow-auto rounded-md border border-line">
          {matches.map((shop) => (
            <button
              key={shop.shopId}
              type="button"
              className="block w-full px-2 py-1 text-left text-sm hover:bg-line/40"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange({ ...row, shopId: shop.shopId, shopName: shop.name, place: shop.place, listed: true });
                setOpen(false);
              }}
            >
              {shop.shopId} · {shop.name}
            </button>
          ))}
        </div>
      ) : null}
      <label className="flex items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={!row.listed}
          onChange={(event) => onChange({ ...row, listed: !event.target.checked, shopId: event.target.checked ? '' : row.shopId })}
        />
        Shop is not in our list (notes only, not saved to directory)
      </label>
      <Field label="PLACE">
        <Input placeholder="Place" value={row.place} onChange={(event) => onChange({ ...row, place: event.target.value })} />
      </Field>
    </div>
  );
}

function ReceivedFields({
  shops,
  pay,
  row,
  onChange,
}: {
  shops: SalesShop[];
  pay: SalesPaymentsView | null;
  row: ReceivedRow;
  onChange: (row: ReceivedRow) => void;
}) {
  const period = useMemo(() => collectionPeriod(new Date(), 'Asia/Kolkata'), []);
  const [month, setMonth] = useState((pay?.month || period.tab).toLowerCase());
  const year = pay?.year || period.year;
  const [sheet, setSheet] = useState<SalesPaymentsView | null>(null);
  const [loading, setLoading] = useState(true);
  const [sheetError, setSheetError] = useState('');
  const [query, setQuery] = useState(row.shopName);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSheetError('');
    void getSalesPaymentsRequest(month, year)
      .then((data) => {
        if (cancelled) {
          return;
        }
        setSheet(data);
      })
      .catch((cause) => {
        if (!cancelled) {
          setSheetError(cause instanceof Error ? cause.message : 'Unable to load that month sheet.');
          setSheet(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [month, year]);

  const excelRows = sheet?.rows ?? [];
  const needle = query.trim().toLowerCase();
  const excelMatches = excelRows.filter(
    (item) => !needle || `${item.shopId} ${item.shopName} ${item.place}`.toLowerCase().includes(needle),
  );
  const directoryMatches = shops.filter((shop) => !needle || `${shop.shopId} ${shop.name}`.toLowerCase().includes(needle));
  const tabs = sheet?.tabs?.length ? sheet.tabs : pay?.tabs?.length ? pay.tabs : [...SALES_MONTH_TABS];

  function pickExcel(shop: SalesPaymentsView['rows'][number]) {
    onChange({
      ...applyExcelShop(row, shop, shop.shopId, shop.shopName),
      month,
      year: sheet?.year ?? year,
      sheetRow: shop.sheetRow,
    });
    setQuery(`${shop.shopId} ${shop.shopName}`.trim());
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Month sheet">
          <Select
            value={month}
            onChange={(event) => {
              setMonth(event.target.value.toLowerCase());
              setQuery('');
              onChange({
                ...row,
                shopId: '',
                shopName: '',
                amount: '',
                ref: '',
                month: event.target.value.toLowerCase(),
                year,
                sheetRow: null,
              });
            }}
          >
            {tabs.map((tab) => (
              <option key={tab} value={tab.toLowerCase()}>
                {tab[0]?.toUpperCase()}
                {tab.slice(1)}
                {tab.toLowerCase() === period.tab ? ' (current collection)' : ''}
              </option>
            ))}
          </Select>
        </Field>
        <p className="mt-1 text-xs text-muted">
          Shops from {sheet?.tabTitle || month} {year}. Default is {period.tab} (previous calendar month).
        </p>
      </div>
      <div className="sm:col-span-2 space-y-1">
        <Field label="Store name or ID">
          <Input
            placeholder="Search this month’s Excel shops"
            value={query}
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
              const excel = excelRows.find(
                (item) => item.shopId === value || item.shopName.toLowerCase() === value.trim().toLowerCase(),
              );
              const hit = shops.find((shop) => shop.shopId === value || shop.name.toLowerCase() === value.trim().toLowerCase());
              if (excel) {
                onChange({
                  ...applyExcelShop(row, excel, excel.shopId, excel.shopName),
                  month,
                  year: sheet?.year ?? year,
                  sheetRow: excel.sheetRow,
                });
                return;
              }
              onChange(
                hit
                  ? { ...row, shopId: hit.shopId, shopName: hit.name, month, year, sheetRow: null }
                  : { ...row, shopId: '', shopName: value, month, year, sheetRow: null },
              );
            }}
          />
        </Field>
        {loading ? (
          <p className="text-xs text-muted">Loading shops from the {month} sheet…</p>
        ) : null}
        {sheetError ? <p className="text-xs text-rose">{sheetError}</p> : null}
        {!loading && excelMatches.length > 0 ? (
          <div className="max-h-40 overflow-auto rounded-md border border-line">
            {excelMatches.slice(0, 60).map((shop) => (
              <button
                key={`${shop.sheetRow}-${shop.shopId}`}
                type="button"
                className={`block w-full px-2 py-1.5 text-left text-sm hover:bg-line/40 ${
                  row.shopId && row.shopId === shop.shopId ? 'bg-sage-soft' : ''
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pickExcel(shop)}
              >
                <span className="font-mono text-xs">{shop.shopId || '—'}</span>
                {' · '}
                {shop.shopName}
                {shop.place ? <span className="text-muted"> · {shop.place}</span> : null}
              </button>
            ))}
          </div>
        ) : null}
        {!loading && !sheetError && excelRows.length === 0 ? (
          <div className="max-h-40 overflow-auto rounded-md border border-line">
            {directoryMatches.slice(0, 40).map((shop) => (
              <button
                key={shop.shopId}
                type="button"
                className="block w-full px-2 py-1.5 text-left text-sm hover:bg-line/40"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange({ ...row, shopId: shop.shopId, shopName: shop.name, month, year, sheetRow: null });
                  setQuery(`${shop.shopId} ${shop.name}`.trim());
                }}
              >
                {shop.shopId} · {shop.name}
              </button>
            ))}
          </div>
        ) : null}
        {!loading && !excelRows.length && !directoryMatches.length ? (
          <p className="text-xs text-muted">No shop rows on this month tab.</p>
        ) : null}
      </div>
      <Field label="Amount (₹)">
        <Input type="number" min={0} placeholder="0" value={row.amount} onChange={(event) => onChange({ ...row, amount: event.target.value })} />
      </Field>
      <Field label="GST type">
        <Select value={row.gst} onChange={(event) => onChange({ ...row, gst: event.target.value as 'GST' | 'Non-GST' })}>
          <option value="GST">GST</option>
          <option value="Non-GST">Non-GST</option>
        </Select>
      </Field>
      <Field label="Mode of payment">
        <Select value={row.mode} onChange={(event) => onChange({ ...row, mode: event.target.value as ReceivedRow['mode'] })}>
          <option>Cash</option>
          <option>Cheque</option>
          <option>UPI</option>
        </Select>
      </Field>
      <Field label="Payment ref">
        <Input placeholder="Transaction / reference no." value={row.ref} onChange={(event) => onChange({ ...row, ref: event.target.value })} />
      </Field>
      {row.mode === 'Cheque' ? (
        <Field label="Bank name">
          <Input placeholder="Bank name" value={row.bankName} onChange={(event) => onChange({ ...row, bankName: event.target.value })} />
        </Field>
      ) : null}
    </div>
  );
}

function PaymentEditor({
  row,
  statusOptions,
  modeOptions,
  showAccounts,
  onSave,
}: {
  row: SalesPaymentsView['rows'][number];
  statusOptions: string[];
  modeOptions: string[];
  showAccounts: boolean;
  onSave: (row: SalesPaymentsView['rows'][number], status: string, mode: string, reference: string, date: string) => void;
}) {
  const [status, setStatus] = useState(row.status);
  const [mode, setMode] = useState(row.paymentMode);
  const [reference, setReference] = useState(row.reference);
  const [date, setDate] = useState(row.date);
  useEffect(() => {
    setStatus(row.status);
    setMode(row.paymentMode);
    setReference(row.reference);
    setDate(row.date);
  }, [row.status, row.paymentMode, row.reference, row.date, row.shopId]);
  return (
    <tr className="border-b border-line align-top">
      <td className="px-3 py-2 font-mono text-xs">{row.shopId}</td>
      <td className="px-3 py-2">{row.shopName}</td>
      <td className="px-3 py-2 text-muted">{row.place}</td>
      {showAccounts ? (
        <>
          <td className="px-3 py-2">{inr(row.amount)}</td>
          <td className="px-3 py-2">{row.gst}</td>
        </>
      ) : null}
      <td className="px-3 py-2">
        <Select value={status} onChange={(event) => setStatus(event.target.value)}>
          {[status, ...statusOptions.filter((item) => item !== status)].filter(Boolean).map((item) => (
            <option key={item}>{item}</option>
          ))}
        </Select>
      </td>
      <td className="px-3 py-2">
        <Select value={mode} onChange={(event) => setMode(event.target.value)}>
          {[mode, ...modeOptions.filter((item) => item !== mode)].filter(Boolean).map((item) => (
            <option key={item}>{item}</option>
          ))}
        </Select>
      </td>
      <td className="px-3 py-2">
        <Input value={date} placeholder="DATE" onChange={(event) => setDate(event.target.value)} />
      </td>
      <td className="px-3 py-2">
        <Input value={reference} placeholder="REFERNCE NO" onChange={(event) => setReference(event.target.value)} />
      </td>
      <td className="px-3 py-2">
        <Button
          type="button"
          variant="outline"
          className="h-8 px-2 text-xs"
          disabled={!row.shopId && !row.shopName}
          onClick={() => onSave(row, status, mode, reference, date)}
        >
          Save
        </Button>
        {row.updatedByName ? <p className="mt-1 text-[11px] text-muted">{row.updatedByName}</p> : null}
      </td>
    </tr>
  );
}
