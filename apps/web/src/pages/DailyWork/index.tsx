import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MutableRefObject,
  type RefObject,
} from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { DailyWorkEntry, DailyWorkToday } from '@teakflow/shared';
import { mergeNotebook } from '@teakflow/shared';
import {
  NotebookEditor,
  type NotebookEditorApi,
  type NotebookPagesHandle,
} from '@/components/daily-work/NotebookEditor';
import { NotebookNote } from '@/components/daily-work/NotebookNote';
import { NotebookToolbar } from '@/components/daily-work/NotebookToolbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NotebookModal } from '@/components/ui/notebook-modal';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getHistoryRequest,
  getTodayRequest,
  submitTodayRequest,
  updateTodayRequest,
} from '@/features/dailyWork/api';
import {
  clearDraft,
  listPlanDates,
  readDraft,
  readPlan,
  writeDraft,
  writePlan,
} from '@/features/dailyWork/draft';
import { cn } from '@/lib/cn';
import { formatClockLabel } from '@/lib/formatClock';
import { noteCharacterCount } from '@/lib/notebookFormat';
import {
  addMonths,
  monthGrid,
  monthLabel,
  splitWorkDate,
  WEEKDAYS,
} from '@/lib/workCalendar';

function formatDay(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatSubmittedAt(value: string | null, timezone: string) {
  if (!value) {
    return '';
  }
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  }).format(new Date(value));
}

export function DailyWorkPage() {
  const location = useLocation();
  const isPlan = location.pathname === '/daily-work/plan';
  const [today, setToday] = useState<DailyWorkToday | null>(null);
  const [history, setHistory] = useState<DailyWorkEntry[]>([]);
  const [content, setContent] = useState('');
  const [planContent, setPlanContent] = useState('');
  const [planDates, setPlanDates] = useState<Set<string>>(() => new Set());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [month, setMonth] = useState<{ year: number; month: number } | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const editorRef = useRef<NotebookEditorApi | null>(null);
  const pagesRef = useRef<NotebookPagesHandle>({ pages: [''], pageIndex: 0 });
  const draftAtOpen = useRef('');
  const contentRef = useRef('');
  const savedTimer = useRef(0);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const planRef = useRef('');

  contentRef.current = content;
  planRef.current = planContent;

  function persistNote(next: string) {
    setContent(next);
    contentRef.current = next;
    if (!today) {
      return;
    }
    writeDraft(today.workDate, next);
    draftAtOpen.current = next;
    window.clearTimeout(savedTimer.current);
    if (!next.trim()) {
      setSaveStatus('idle');
      return;
    }
    setSaveStatus('saving');
    savedTimer.current = window.setTimeout(() => setSaveStatus('saved'), 450);
  }

  function persistPlan(next: string) {
    setPlanContent(next);
    planRef.current = next;
    const date = selectedDate;
    if (!date) {
      return;
    }
    writePlan(date, next);
    setPlanDates(listPlanDates());
    window.clearTimeout(savedTimer.current);
    if (!next.trim()) {
      setSaveStatus('idle');
      return;
    }
    setSaveStatus('saving');
    savedTimer.current = window.setTimeout(() => setSaveStatus('saved'), 450);
  }

  useEffect(() => {
    function flushDraft() {
      if (!today || (today.state !== 'OPEN' && today.state !== 'LATE_AVAILABLE')) {
        return;
      }
      writeDraft(today.workDate, contentRef.current);
    }

    function onHide() {
      if (document.visibilityState === 'hidden') {
        flushDraft();
      }
    }

    window.addEventListener('pagehide', flushDraft);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flushDraft);
      document.removeEventListener('visibilitychange', onHide);
      window.clearTimeout(savedTimer.current);
    };
  }, [today]);

  async function load() {
    const [nextToday, nextHistory] = await Promise.all([
      getTodayRequest(),
      getHistoryRequest(),
    ]);
    setToday(nextToday);
    setHistory(nextHistory);
    setPlanDates(listPlanDates());
    setMonth((current) => current ?? splitWorkDate(nextToday.workDate));
    if (nextToday.state === 'OPEN' || nextToday.state === 'LATE_AVAILABLE') {
      const next = mergeNotebook(
        readDraft(nextToday.workDate),
        nextToday.salesNotebook ?? '',
      );
      setContent(next);
      writeDraft(nextToday.workDate, next);
      draftAtOpen.current = next;
    } else if (nextToday.state === 'SUBMITTED_EDITABLE' && nextToday.entry) {
      const next = mergeNotebook(nextToday.entry.content, nextToday.salesNotebook ?? '');
      setContent(next);
      draftAtOpen.current = next;
    }
  }

  useEffect(() => {
    if (!today || today.state !== 'SUBMITTED_EDITABLE' || !today.entry) {
      return;
    }
    if (selectedDate === today.workDate) {
      const next = mergeNotebook(today.entry.content, today.salesNotebook ?? '');
      setContent(next);
      draftAtOpen.current = next;
      setSaveStatus('saved');
    }
  }, [today, selectedDate]);

  useEffect(() => {
    let cancelled = false;
    load()
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Unable to load daily work.');
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
  }, [location.pathname]);

  useEffect(() => {
    setSelectedDate(null);
    setError('');
    setSaveStatus('idle');
  }, [isPlan]);

  const byDate = useMemo(() => {
    const map = new Map<string, DailyWorkEntry>();
    for (const entry of history) {
      map.set(entry.workDate, entry);
    }
    if (today?.entry) {
      map.set(today.entry.workDate, today.entry);
    }
    return map;
  }, [history, today]);

  const cells = month ? monthGrid(month.year, month.month) : [];
  const todayKey = today?.workDate ?? '';
  const selectedEntry = selectedDate ? (byDate.get(selectedDate) ?? null) : null;
  const isSelectedToday = Boolean(today && selectedDate === today.workDate);
  const canWrite = Boolean(
    isSelectedToday &&
    today &&
    (today.state === 'OPEN' ||
      today.state === 'LATE_AVAILABLE' ||
      today.state === 'SUBMITTED_EDITABLE'),
  );
  const canWritePlan = Boolean(today && selectedDate && selectedDate >= today.workDate);
  const startLabel = today ? formatClockLabel(today.settings.startTime) : '';
  const endLabel = today ? formatClockLabel(today.settings.endTime) : '';

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!today) {
      return;
    }
    setError('');
    setPending(true);
    try {
      if (today.state === 'SUBMITTED_EDITABLE') {
        await updateTodayRequest(content);
      } else {
        await submitTodayRequest(content);
      }
      clearDraft(today.workDate);
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : today.state === 'SUBMITTED_EDITABLE'
            ? 'Unable to save your changes.'
            : 'Unable to submit your work.',
      );
    } finally {
      setPending(false);
    }
  }

  const weekRows = Math.max(1, Math.ceil(cells.length / 7));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="flex shrink-0 items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs tracking-wide text-muted uppercase">
            Daily work
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {month ? monthLabel(month.year, month.month) : 'Calendar'}
          </h1>
          {today ? (
            <p className="mt-1 text-sm text-muted">
              {isPlan
                ? 'Plan the day. This is not your submitted work.'
                : `Window ${startLabel} – ${endLabel}`}
            </p>
          ) : null}
        </div>
        {month ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded-md p-2 text-muted hover:bg-line/60 hover:text-ink"
              onClick={() => setMonth(addMonths(month.year, month.month, -1))}
              aria-label="Previous month"
            >
              <ChevronLeft size={18} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              className="rounded-md p-2 text-muted hover:bg-line/60 hover:text-ink"
              onClick={() => setMonth(addMonths(month.year, month.month, 1))}
              aria-label="Next month"
            >
              <ChevronRight size={18} strokeWidth={1.75} />
            </button>
          </div>
        ) : null}
      </header>

      {loading || !today || !month ? (
        <CalendarSkeleton />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-line bg-surface">
          <div
            className="flex shrink-0 items-center gap-1 border-b border-line px-2"
            role="tablist"
            aria-label="Daily work pages"
          >
            <WorkPlanTab to="/daily-work" active={!isPlan}>
              Work
            </WorkPlanTab>
            <WorkPlanTab to="/daily-work/plan" active={isPlan}>
              Plan
            </WorkPlanTab>
          </div>
          <div className="grid shrink-0 grid-cols-7 border-b border-line">
            {WEEKDAYS.map((day) => (
              <p
                key={day}
                className="px-2 py-2.5 text-center font-mono text-[11px] text-muted"
              >
                {day}
              </p>
            ))}
          </div>
          <div
            className="grid min-h-0 flex-1 grid-cols-7"
            style={{ gridTemplateRows: `repeat(${weekRows}, minmax(0, 1fr))` }}
          >
            {cells.map((cell, index) => {
              if (!cell.date || !cell.day) {
                return (
                  <div
                    key={`empty-${index}`}
                    className="border-t border-line bg-paper/50"
                  />
                );
              }
              const date = cell.date;
              const entry = byDate.get(date);
              const hasPlan = planDates.has(date);
              const isToday = date === todayKey;
              const isFuture = date > todayKey;
              const isSelected = date === selectedDate;
              return (
                <button
                  key={date}
                  type="button"
                  className={cn(
                    'border-t border-l border-line px-1.5 py-2 text-left first:border-l-0 sm:px-3 sm:py-2.5',
                    index % 7 === 0 && 'border-l-0',
                    isSelected ? 'bg-sage-soft' : 'bg-surface hover:bg-line/40',
                  )}
                  onClick={() => {
                    setSelectedDate(date);
                    setError('');
                    setSaveStatus('idle');
                    if (isPlan) {
                      const nextPlan = readPlan(date);
                      setPlanContent(nextPlan);
                      setSaveStatus(nextPlan.trim() ? 'saved' : 'idle');
                      return;
                    }
                    if (!isToday || !today) {
                      draftAtOpen.current = '';
                      return;
                    }
                    if (today.state === 'SUBMITTED_EDITABLE' && today.entry) {
                      setContent(today.entry.content);
                      draftAtOpen.current = today.entry.content;
                      setSaveStatus('saved');
                      return;
                    }
                    if (today.state === 'OPEN' || today.state === 'LATE_AVAILABLE') {
                      const draft = readDraft(today.workDate);
                      setContent(draft);
                      draftAtOpen.current = draft;
                      setSaveStatus(draft.trim() ? 'saved' : 'idle');
                      return;
                    }
                    draftAtOpen.current = '';
                  }}
                >
                  <span
                    className={cn(
                      'inline-flex h-7 w-7 items-center justify-center rounded-full font-mono text-sm',
                      isToday && 'bg-sage text-surface',
                    )}
                  >
                    {cell.day}
                  </span>
                  <span className="mt-2 block">
                    {isPlan ? (
                      hasPlan ? (
                        <Badge tone="sage">Plan</Badge>
                      ) : isFuture || isToday ? (
                        <Badge tone="neutral">Write</Badge>
                      ) : (
                        <span className="text-[11px] text-muted">No plan</span>
                      )
                    ) : entry ? (
                      <Badge tone={entry.isLate ? 'amber' : 'sage'}>
                        {isToday && today.state === 'SUBMITTED_EDITABLE'
                          ? 'Edit'
                          : entry.isLate
                            ? 'Late'
                            : 'Done'}
                      </Badge>
                    ) : isToday ? (
                      <Badge
                        tone={
                          today.state === 'LOCKED'
                            ? 'amber'
                            : today.state === 'MISSED'
                              ? 'rose'
                              : 'neutral'
                        }
                      >
                        {today.state === 'LOCKED'
                          ? 'Soon'
                          : today.state === 'OPEN' || today.state === 'LATE_AVAILABLE'
                            ? 'Write'
                            : 'Missed'}
                      </Badge>
                    ) : isFuture ? (
                      <span className="text-[11px] text-muted"> </span>
                    ) : (
                      <span className="text-[11px] text-muted">No entry</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <NotebookModal
        open={Boolean(selectedDate)}
        dateLabel={selectedDate ? formatDay(selectedDate) : 'Notebook'}
        dirty={false}
        onClose={() => setSelectedDate(null)}
        onSave={() => {
          if (isPlan && selectedDate) {
            writePlan(selectedDate, planRef.current);
            setPlanDates(listPlanDates());
            return;
          }
          if (today) {
            writeDraft(today.workDate, contentRef.current);
            draftAtOpen.current = contentRef.current;
          }
        }}
        onDiscard={() => {
          if (isPlan && selectedDate) {
            writePlan(selectedDate, '');
            setPlanContent('');
            setPlanDates(listPlanDates());
            return;
          }
          if (today) {
            clearDraft(today.workDate);
          }
          setContent('');
          draftAtOpen.current = '';
        }}
        toolbar={
          (isPlan ? canWritePlan : canWrite) ? (
            <NotebookToolbar getEditor={() => editorRef.current} />
          ) : undefined
        }
        footer={
          isPlan && selectedDate && today && canWritePlan ? (
            <p className="font-mono text-xs text-muted">
              {noteCharacterCount(planContent)} characters
              {saveStatus === 'saving'
                ? ' · Saving…'
                : saveStatus === 'saved'
                  ? ' · Saved'
                  : ''}
            </p>
          ) : isPlan && selectedDate ? (
            <p className="font-mono text-xs text-muted">Past plans are locked.</p>
          ) : selectedDate && today && canWrite ? (
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-xs text-muted">
                {noteCharacterCount(content)} characters
                {noteCharacterCount(content) < today.settings.minCharacters
                  ? ` · ${today.settings.minCharacters} minimum`
                  : ''}
                {saveStatus === 'saving'
                  ? ' · Saving…'
                  : saveStatus === 'saved'
                    ? ' · Saved'
                    : ''}
              </p>
              <Button type="submit" form="daily-work-notebook" disabled={pending}>
                {pending
                  ? today.state === 'SUBMITTED_EDITABLE'
                    ? 'Saving…'
                    : 'Submitting…'
                  : today.state === 'SUBMITTED_EDITABLE'
                    ? 'Save changes'
                    : today.state === 'LATE_AVAILABLE'
                      ? 'Submit late'
                      : 'Submit work'}
              </Button>
            </div>
          ) : selectedEntry ? (
            <p className="font-mono text-xs text-muted">
              Submitted at{' '}
              {formatSubmittedAt(
                selectedEntry.submittedAt,
                today?.timezone ?? 'Asia/Kolkata',
              )}
              {selectedEntry.isLate ? ' · Late' : ''}
              {today?.state === 'SUBMITTED_EDITABLE' && isSelectedToday
                ? ' · Editable today'
                : ' · Locked'}
            </p>
          ) : null
        }
      >
        {selectedDate && today && isPlan ? (
          <PlanDetail
            date={selectedDate}
            today={today}
            canWrite={canWritePlan}
            content={planContent}
            persistNote={persistPlan}
            editorRef={editorRef}
            pagesRef={pagesRef}
          />
        ) : selectedDate && today ? (
          <DayDetail
            date={selectedDate}
            today={today}
            entry={selectedEntry}
            isToday={isSelectedToday}
            canWrite={canWrite}
            startLabel={startLabel}
            content={content}
            persistNote={persistNote}
            error={error}
            editorRef={editorRef}
            pagesRef={pagesRef}
            onSubmit={onSubmit}
          />
        ) : null}
      </NotebookModal>
    </div>
  );
}

function WorkPlanTab({
  to,
  active,
  children,
}: {
  to: string;
  active: boolean;
  children: string;
}) {
  return (
    <Link
      to={to}
      role="tab"
      aria-selected={active}
      className={cn(
        'relative px-3 py-2.5 text-sm font-medium transition-colors duration-160',
        active ? 'text-ink' : 'text-muted hover:text-ink',
      )}
    >
      {children}
      {active ? (
        <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-sage" />
      ) : null}
    </Link>
  );
}

function CalendarSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-line bg-surface">
      <div className="flex shrink-0 items-center gap-1 border-b border-line px-2 py-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
      </div>
      <div className="grid shrink-0 grid-cols-7 border-b border-line p-2">
        {WEEKDAYS.map((day) => (
          <Skeleton key={day} className="mx-auto h-3 w-8" />
        ))}
      </div>
      <div
        className="grid min-h-0 flex-1 grid-cols-7"
        style={{ gridTemplateRows: 'repeat(5, minmax(0, 1fr))' }}
      >
        {Array.from({ length: 35 }, (_, index) => (
          <div key={index} className="border-t border-line p-2 sm:p-3">
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="mt-3 h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DayDetail({
  date,
  today,
  entry,
  isToday,
  canWrite,
  startLabel,
  content,
  persistNote,
  error,
  editorRef,
  pagesRef,
  onSubmit,
}: {
  date: string;
  today: DailyWorkToday;
  entry: DailyWorkEntry | null;
  isToday: boolean;
  canWrite: boolean;
  startLabel: string;
  content: string;
  persistNote: (value: string) => void;
  error: string;
  editorRef: MutableRefObject<NotebookEditorApi | null>;
  pagesRef: RefObject<NotebookPagesHandle>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (canWrite) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {today.state === 'LATE_AVAILABLE' ? (
          <p className="px-5 pb-0 pl-14 pt-3 text-sm text-amber">Late submission</p>
        ) : null}
        {today.state === 'SUBMITTED_EDITABLE' ? (
          <p className="px-5 pb-0 pl-14 pt-3 text-sm text-muted">
            Submitted — you can keep editing today&apos;s notebook.
          </p>
        ) : null}
        <NotebookEditor
          value={content}
          placeholder="What did you work on today? Type * then space for a bullet."
          editorRef={editorRef}
          pagesRef={pagesRef}
          error={error}
          onSubmit={onSubmit}
          onChange={persistNote}
        />
      </div>
    );
  }

  if (entry) {
    return (
      <div className="h-full min-h-0">
        <NotebookNote text={entry.content} />
      </div>
    );
  }

  if (date > today.workDate) {
    return <p className="notebook-read text-muted">This day has not started yet.</p>;
  }

  if (isToday && today.state === 'LOCKED') {
    return (
      <p className="notebook-read text-muted">
        Daily work opens at {startLabel}. You can write after the workday is completed.
      </p>
    );
  }

  return <p className="notebook-read text-muted">No submission for this day.</p>;
}

function PlanDetail({
  date,
  today,
  canWrite,
  content,
  persistNote,
  editorRef,
  pagesRef,
}: {
  date: string;
  today: DailyWorkToday;
  canWrite: boolean;
  content: string;
  persistNote: (value: string) => void;
  editorRef: MutableRefObject<NotebookEditorApi | null>;
  pagesRef: RefObject<NotebookPagesHandle>;
}) {
  if (canWrite) {
    return (
      <NotebookEditor
        value={content}
        placeholder="What do you plan to work on?"
        editorRef={editorRef}
        pagesRef={pagesRef}
        error=""
        onSubmit={(event) => event.preventDefault()}
        onChange={persistNote}
      />
    );
  }

  if (content.trim()) {
    return (
      <div className="h-full min-h-0">
        <NotebookNote text={content} />
      </div>
    );
  }

  if (date > today.workDate) {
    return <p className="notebook-read text-muted">This day has not started yet.</p>;
  }

  return <p className="notebook-read text-muted">No plan for this day.</p>;
}
