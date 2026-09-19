import { useEffect, useMemo, useState } from 'react';
import {
  DAILY_WORK_STATUS,
  DEPARTMENTS,
  ROLES,
  type DailyWorkAdminRow,
  type DailyWorkAdminView,
  type DailyWorkEntry,
} from '@teakflow/shared';
import { NotebookNote } from '@/components/daily-work/NotebookNote';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { RightPanel } from '@/components/ui/right-panel';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { getAdminDailyWorkRequest, getUserHistoryRequest } from '@/features/dailyWork/api';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/store/auth';

function formatDay(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatTime(value: string | null) {
  if (!value) {
    return '—';
  }
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function DailyWorkMonitorPage() {
  const session = useAuthStore((state) => state.user);
  const role = session?.role;
  const [view, setView] = useState<DailyWorkAdminView | null>(null);
  const [selected, setSelected] = useState<DailyWorkEntry | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<DailyWorkAdminRow | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [queryDate, setQueryDate] = useState<string | undefined>();
  const [companyToday, setCompanyToday] = useState<string | null>(null);
  const [history, setHistory] = useState<DailyWorkEntry[]>([]);

  const headed = session?.headedDepartments ?? [];
  const filterDepartments = headed.length > 0 ? headed : [...DEPARTMENTS];
  const visible = useMemo(() => {
    if (!view) {
      return null;
    }
    const rows = deptFilter === 'all' ? view.rows : view.rows.filter((row) => row.department === deptFilter);
    return {
      ...view,
      rows,
      totalEmployees: rows.length,
      submitted: rows.filter((row) => row.status === DAILY_WORK_STATUS.SUBMITTED).length,
      pending: rows.filter((row) => row.status === DAILY_WORK_STATUS.PENDING).length,
      late: rows.filter((row) => row.status === DAILY_WORK_STATUS.LATE).length,
      missed: rows.filter((row) => row.status === DAILY_WORK_STATUS.MISSED).length,
    };
  }, [deptFilter, view]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAdminDailyWorkRequest(queryDate)
      .then((data) => {
        if (!cancelled) {
          setView(data);
          if (!queryDate) {
            setCompanyToday(data.workDate);
          }
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Unable to load team daily work.');
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
  }, [queryDate]);

  async function openRow(row: DailyWorkAdminRow) {
    setSelectedPerson(row);
    setError('');
    setSelected(null);
    setHistory([]);
    setDetailLoading(true);
    try {
      const past = await getUserHistoryRequest(row.userId);
      setHistory(past);
      const forDay = past.find((entry) => entry.workDate === (view?.workDate ?? queryDate));
      setSelected(forDay ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to open that notebook.');
    } finally {
      setDetailLoading(false);
    }
  }

  function closePanel() {
    setSelectedPerson(null);
    setSelected(null);
    setHistory([]);
    setDetailLoading(false);
  }

  function shiftDate(delta: number) {
    const current = view?.workDate;
    if (!current) {
      return;
    }
    const next = addUtcDays(current, delta);
    const latest = companyToday ?? current;
    if (next > latest) {
      return;
    }
    setQueryDate(next);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Team daily work</h1>
        <p className="mt-1 text-sm text-muted">
          {view ? formatDay(view.workDate) : 'Who submitted, including previous days.'}
          {role === ROLES.MANAGER
            ? ' Your list is your reporting tree (leads and employees under you), grouped by department.'
            : role === ROLES.LEAD
              ? ' Your list is you and employees who report to you.'
              : ''}
        </p>
      </header>

      {error && !selectedPerson ? <p className="text-sm text-rose">{error}</p> : null}

      {loading ? (
        <TeamListSkeleton />
      ) : view && visible ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Count label="Submitted" value={visible.submitted} />
            <Count label="Pending" value={visible.pending} />
            <Count label="Late" value={visible.late} />
            <Count label="Missed" value={visible.missed} />
          </div>
          <p className="text-sm text-muted">People in this view · {visible.totalEmployees}</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="h-8 rounded-md border border-line bg-surface px-3 text-xs font-medium text-muted"
              onClick={() => shiftDate(-1)}
            >
              Previous day
            </button>
            <Input
              type="date"
              className="h-8 w-[10.5rem] text-xs"
              max={companyToday ?? view.workDate}
              value={view.workDate}
              onChange={(event) => {
                const value = event.target.value;
                if (value) {
                  setQueryDate(value);
                }
              }}
            />
            <button
              type="button"
              className="h-8 rounded-md border border-line bg-surface px-3 text-xs font-medium text-muted disabled:opacity-40"
              disabled={Boolean(companyToday && view.workDate >= companyToday)}
              onClick={() => shiftDate(1)}
            >
              Next day
            </button>
            {companyToday && view.workDate !== companyToday ? (
              <button
                type="button"
                className="h-8 rounded-md border border-sage bg-sage-soft px-3 text-xs font-medium text-sage"
                onClick={() => setQueryDate(undefined)}
              >
                Today
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={cn(
                'h-8 rounded-md border px-3 text-xs font-medium',
                deptFilter === 'all' ? 'border-sage bg-sage-soft text-sage' : 'border-line bg-surface text-muted',
              )}
              onClick={() => setDeptFilter('all')}
            >
              All
            </button>
            {filterDepartments.map((department) => (
              <button
                key={department}
                type="button"
                className={cn(
                  'h-8 rounded-md border px-3 text-xs font-medium',
                  deptFilter === department ? 'border-sage bg-sage-soft text-sage' : 'border-line bg-surface text-muted',
                )}
                onClick={() => setDeptFilter(department)}
              >
                {department}
              </button>
            ))}
          </div>
          <GroupedRows
            view={visible}
            headed={headed}
            selectedUserId={selectedPerson?.userId ?? null}
            onOpen={(row) => void openRow(row)}
          />
        </>
      ) : null}

      <RightPanel
        open={Boolean(selectedPerson)}
        title={selectedPerson?.name ?? 'Submission'}
        onClose={closePanel}
      >
        {selectedPerson ? (
          <SubmissionDetail
            person={selectedPerson}
            entry={selected}
            history={history}
            loading={detailLoading}
            error={error}
            onSelectEntry={setSelected}
          />
        ) : null}
      </RightPanel>
    </div>
  );
}

function TeamListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {['a', 'b', 'c', 'd'].map((key) => (
          <Card key={key} className="p-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-3 h-7 w-10" />
          </Card>
        ))}
      </div>
      <Skeleton className="h-4 w-36" />
      <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {['s1', 's2', 's3', 's4', 's5', 's6'].map((key) => (
          <div key={key} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function GroupedRows({
  view,
  headed,
  selectedUserId,
  onOpen,
}: {
  view: DailyWorkAdminView;
  headed: string[];
  selectedUserId: string | null;
  onOpen: (row: DailyWorkAdminRow) => void;
}) {
  const groups = useMemo(() => {
    const order = [
      ...headed.filter((department) => DEPARTMENTS.includes(department as (typeof DEPARTMENTS)[number])),
      ...DEPARTMENTS.filter((department) => !headed.includes(department)),
      'Other',
    ];
    const map = new Map<string, DailyWorkAdminRow[]>();
    for (const key of order) {
      map.set(key, []);
    }
    for (const row of view.rows) {
      const key = row.department && map.has(row.department) ? row.department : 'Other';
      map.get(key)?.push(row);
    }
    return order
      .map((label) => ({ label, rows: map.get(label) ?? [] }))
      .filter((group) => group.rows.length > 0);
  }, [headed, view.rows]);

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.label} className="overflow-hidden rounded-lg border border-line bg-surface">
          <h2 className="border-b border-line px-4 py-2 text-xs font-medium tracking-wide text-muted uppercase">
            {group.label}
          </h2>
          <div className="divide-y divide-line">
            {group.rows.map((row) => (
              <PersonRow
                key={row.userId}
                row={row}
                active={selectedUserId === row.userId}
                onOpen={() => onOpen(row)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function PersonRow({
  row,
  active,
  onOpen,
}: {
  row: DailyWorkAdminRow;
  active: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-line/40',
        active && 'bg-sage-soft',
      )}
      onClick={onOpen}
    >
      <Avatar name={row.name} src={row.avatar} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{row.name}</p>
        <p className="truncate text-xs text-muted">
          {row.designation ?? 'Employee'}
          {row.department ? ` · ${row.department}` : ''}
          {row.submittedAt ? ` · ${formatTime(row.submittedAt)}` : ''}
        </p>
      </div>
      <StatusBadge status={row.status} />
    </button>
  );
}

function addUtcDays(workDate: string, delta: number) {
  const next = new Date(`${workDate}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + delta);
  return next.toISOString().slice(0, 10);
}

function SubmissionDetail({
  person,
  entry,
  history,
  loading,
  error,
  onSelectEntry,
}: {
  person: DailyWorkAdminRow;
  entry: DailyWorkEntry | null;
  history: DailyWorkEntry[];
  loading: boolean;
  error: string;
  onSelectEntry: (entry: DailyWorkEntry) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Avatar name={person.name} src={person.avatar} size={48} />
        <div>
          <p className="text-sm font-medium">{person.name}</p>
          <p className="text-xs text-muted">{person.designation ?? 'Employee'}</p>
        </div>
      </div>
      <StatusBadge status={person.status} />

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      ) : null}

      {!loading && error ? <p className="text-sm text-rose">{error}</p> : null}

      {!loading && entry ? (
        <div className="space-y-3">
          <p className="font-mono text-xs text-muted">
            {formatDay(entry.workDate)}
            {entry.submittedAt ? ` · ${formatTime(entry.submittedAt)}` : ''}
          </p>
          <NotebookNote text={entry.content} compact />
          <p className="text-xs text-muted">This entry cannot be edited after submission.</p>
        </div>
      ) : null}

      {!loading && !entry && !error ? (
        <p className="text-sm text-muted">No submission for this person on this date.</p>
      ) : null}

      {!loading && history.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">Previous days</p>
          <ul className="divide-y divide-line overflow-hidden rounded-md border border-line">
            {history.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-line/40',
                    entry?.id === item.id && 'bg-sage-soft',
                  )}
                  onClick={() => onSelectEntry(item)}
                >
                  <span>{formatDay(item.workDate)}</span>
                  <StatusBadge status={item.isLate ? DAILY_WORK_STATUS.LATE : DAILY_WORK_STATUS.SUBMITTED} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!loading && history.length === 0 && !error ? (
        <p className="text-sm text-muted">This person has no previous daily work yet.</p>
      ) : null}
    </div>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === DAILY_WORK_STATUS.SUBMITTED) {
    return <Badge tone="sage">Submitted</Badge>;
  }
  if (status === DAILY_WORK_STATUS.LATE) {
    return <Badge tone="amber">Late</Badge>;
  }
  if (status === DAILY_WORK_STATUS.MISSED) {
    return <Badge tone="rose">Missed</Badge>;
  }
  return <Badge tone="neutral">Pending</Badge>;
}
