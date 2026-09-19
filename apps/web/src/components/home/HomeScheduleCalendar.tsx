import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Meeting } from '@teakflow/shared';
import { Button, buttonClassName } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { GoogleMeetIcon } from '@/components/ui/google-meet-icon';
import { joinMeetingRequest } from '@/features/meetings/api';
import { cn } from '@/lib/cn';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function mondayOfWeek(date: Date) {
  const start = startOfLocalDay(date);
  const weekday = (start.getDay() + 6) % 7;
  return addDays(start, -weekday);
}

function formatHour(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatRange(start: string, end: string) {
  return `${formatHour(start)} – ${formatHour(end)}`;
}

function meetingDayKey(meeting: Meeting) {
  return dayKey(new Date(meeting.startTime));
}

export function HomeScheduleCalendar({
  meetings,
  onError,
}: {
  meetings: Meeting[];
  onError?: (message: string) => void;
}) {
  const today = useMemo(() => startOfLocalDay(new Date()), []);
  const [selectedKey, setSelectedKey] = useState(() => dayKey(today));
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => mondayOfWeek(today));

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );

  const countsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const meeting of meetings) {
      const key = meetingDayKey(meeting);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [meetings]);

  const dayMeetings = useMemo(() => {
    return meetings
      .filter((meeting) => meetingDayKey(meeting) === selectedKey)
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime() ||
          a.title.localeCompare(b.title),
      );
  }, [meetings, selectedKey]);

  const selectedDate = useMemo(() => {
    const [y, m, d] = selectedKey.split('-').map(Number);
    return new Date(y!, (m ?? 1) - 1, d ?? 1);
  }, [selectedKey]);

  const selectedLabel = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(selectedDate);

  const isTodaySelected = selectedKey === dayKey(today);

  async function join(id: string) {
    setJoiningId(id);
    try {
      const result = await joinMeetingRequest(id);
      window.open(result.googleMeetUrl, '_blank', 'noopener,noreferrer');
    } catch (cause) {
      onError?.(cause instanceof Error ? cause.message : 'Unable to join the meeting.');
    } finally {
      setJoiningId(null);
    }
  }

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted uppercase">Schedule</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">
            {isTodaySelected ? 'Today' : selectedLabel}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {dayMeetings.length === 0
              ? 'No meetings on this day.'
              : `${dayMeetings.length} meeting${dayMeetings.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-md px-2.5 py-1.5 text-sm text-muted hover:bg-line/60 hover:text-ink"
            onClick={() => setWeekStart((current) => addDays(current, -7))}
            aria-label="Previous week"
          >
            Prev
          </button>
          <button
            type="button"
            className="rounded-md px-2.5 py-1.5 text-sm text-muted hover:bg-line/60 hover:text-ink"
            onClick={() => {
              const monday = mondayOfWeek(today);
              setWeekStart(monday);
              setSelectedKey(dayKey(today));
            }}
          >
            Today
          </button>
          <button
            type="button"
            className="rounded-md px-2.5 py-1.5 text-sm text-muted hover:bg-line/60 hover:text-ink"
            onClick={() => setWeekStart((current) => addDays(current, 7))}
            aria-label="Next week"
          >
            Next
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {weekDays.map((date, index) => {
          const key = dayKey(date);
          const count = countsByDay.get(key) ?? 0;
          const isSelected = key === selectedKey;
          const isToday = key === dayKey(today);
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedKey(key)}
              className={cn(
                'flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-lg border px-1 py-2 transition-colors sm:min-h-[84px]',
                isSelected
                  ? 'border-sage bg-sage-soft text-ink'
                  : 'border-line bg-paper/60 text-ink hover:bg-line/40',
              )}
            >
              <span className="font-mono text-[10px] tracking-wide text-muted uppercase">
                {WEEKDAYS[index]}
              </span>
              <span
                className={cn(
                  'inline-flex h-7 w-7 items-center justify-center rounded-full font-mono text-sm',
                  isToday && !isSelected && 'bg-sage text-surface',
                  isToday && isSelected && 'bg-sage text-surface',
                )}
              >
                {date.getDate()}
              </span>
              <span className="flex h-1.5 items-center gap-0.5">
                {count > 0 ? (
                  Array.from({ length: Math.min(count, 3) }, (_, dot) => (
                    <span
                      key={dot}
                      className={cn('h-1.5 w-1.5 rounded-full', isSelected ? 'bg-sage' : 'bg-amber')}
                    />
                  ))
                ) : (
                  <span className="h-1.5 w-1.5" />
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-lg border border-line">
        {dayMeetings.length === 0 ? (
          <div className="bg-paper/40 px-4 py-10 text-center">
            <p className="text-sm text-muted">Nothing scheduled for this day.</p>
            <Link to="/meetings" className={buttonClassName('outline', 'mt-4 inline-flex')}>
              Open meetings
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {dayMeetings.map((meeting) => {
              const now = Date.now();
              const start = new Date(meeting.startTime).getTime();
              const end = new Date(meeting.endTime).getTime();
              const live = start <= now && now <= end;
              const past = end < now;
              return (
                <li
                  key={meeting.id}
                  className={cn(
                    'flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between',
                    past && 'opacity-70',
                  )}
                >
                  <div className="flex min-w-0 gap-3">
                    <div className="w-16 shrink-0 font-mono text-xs text-muted sm:w-20">
                      <p>{formatHour(meeting.startTime)}</p>
                      <p className="mt-0.5 text-[10px]">{formatHour(meeting.endTime)}</p>
                    </div>
                    <div className="min-w-0 border-l border-line pl-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <GoogleMeetIcon size={16} />
                        <p className="truncate text-sm font-medium text-ink">{meeting.title}</p>
                        {live ? (
                          <span className="rounded-md bg-sage-soft px-1.5 py-0.5 text-[10px] font-medium text-sage">
                            Now
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {formatRange(meeting.startTime, meeting.endTime)}
                        {meeting.participants.length
                          ? ` · ${meeting.participants.length} people`
                          : ''}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant={live ? 'primary' : 'outline'}
                    className="w-full shrink-0 sm:w-auto"
                    disabled={joiningId === meeting.id || !meeting.googleMeetUrl}
                    onClick={() => void join(meeting.id)}
                  >
                    <GoogleMeetIcon size={16} />
                    {joiningId === meeting.id ? 'Opening…' : 'Join Meet'}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
