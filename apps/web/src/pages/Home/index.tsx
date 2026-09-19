import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { ROLES, type DailyWorkToday, type Meeting } from '@teakflow/shared';
import { HomeIdCard } from '@/components/home/HomeIdCard';
import { HomeScheduleCalendar } from '@/components/home/HomeScheduleCalendar';
import { Badge } from '@/components/ui/badge';
import { buttonClassName } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorBanner, PageLoading } from '@/components/ui/page-state';
import { getTodayRequest } from '@/features/dailyWork/api';
import { listUnreadTotalRequest } from '@/features/chat/api';
import { listMeetingsRequest } from '@/features/meetings/api';
import { formatClockLabel } from '@/lib/formatClock';
import { useAuthStore } from '@/store/auth';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function firstName(name: string) {
  return name.split(' ')[0] ?? name;
}

export function HomePage() {
  const user = useAuthStore((state) => state.user);
  const showIdCard = Boolean(user && user.role !== ROLES.ADMIN);
  const [today, setToday] = useState<DailyWorkToday | null>(null);
  const [unread, setUnread] = useState<number | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [homeError, setHomeError] = useState('');
  const [meetingsError, setMeetingsError] = useState('');
  const [loadingHome, setLoadingHome] = useState(true);
  const dateLabel = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([getTodayRequest(), listUnreadTotalRequest(), listMeetingsRequest()])
      .then(([todayResult, unreadResult, meetingsResult]) => {
        if (cancelled) {
          return;
        }
        if (todayResult.status === 'fulfilled') {
          setToday(todayResult.value);
        } else {
          setHomeError('Unable to load daily work status.');
        }
        if (unreadResult.status === 'fulfilled') {
          setUnread(unreadResult.value.unreadTotal);
        }
        if (meetingsResult.status === 'fulfilled') {
          setMeetings(meetingsResult.value);
        } else {
          setMeetingsError(
            meetingsResult.reason instanceof Error
              ? meetingsResult.reason.message
              : 'Unable to load meetings.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingHome(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative min-h-[calc(100dvh-3rem)] w-full">
      {showIdCard && user ? (
        <div className="pointer-events-none absolute inset-0 z-10 hidden lg:block">
          <HomeIdCard user={user} placement="overlay" />
        </div>
      ) : null}

      <div
        className={
          showIdCard
            ? 'pointer-events-none relative z-20 grid min-h-[calc(100dvh-3rem)] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(300px,40%)]'
            : 'relative z-[2]'
        }
      >
        <div className="pointer-events-none space-y-8 pt-5 md:pt-8 lg:pr-8">
          <div className="pointer-events-auto relative z-20 max-w-3xl space-y-8">
            <header className="space-y-1">
              <p className="font-mono text-xs tracking-wide text-muted uppercase">{dateLabel}</p>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {greeting()}, {firstName(user?.name ?? 'there')}
              </h1>
              <p className="text-sm text-muted">A quiet view of today. Nothing extra.</p>
            </header>

            {homeError ? <ErrorBanner message={homeError} /> : null}
            {loadingHome ? (
              <PageLoading rows={2} />
            ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted uppercase">Daily work</p>
                    <h2 className="mt-2 text-lg font-semibold">{homeTitle(today)}</h2>
                    <p className="mt-1 text-sm text-muted">{homeDetail(today)}</p>
                  </div>
                  <HomeBadge today={today} />
                </div>
                <Link to="/daily-work" className={buttonClassName('soft', 'mt-5')}>
                  View today&apos;s work
                  <ArrowRight size={16} />
                </Link>
              </Card>

              <Card>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted uppercase">Chat</p>
                    <h2 className="mt-2 text-lg font-semibold">
                      {unread && unread > 0 ? `${unread} unread` : 'No unread'}
                    </h2>
                    <p className="mt-1 text-sm text-muted">
                      {unread && unread > 0 ? 'Open chat to catch up.' : 'Messages will appear here'}
                    </p>
                  </div>
                  {unread && unread > 0 ? <Badge tone="sage">{unread} new</Badge> : null}
                </div>
                <Link to="/chat" className={buttonClassName('outline', 'mt-5')}>
                  Open chat
                </Link>
              </Card>
            </div>
            )}

            {meetingsError ? <ErrorBanner message={meetingsError} /> : null}
            <HomeScheduleCalendar meetings={meetings} onError={setMeetingsError} />

            {showIdCard && user ? (
              <section className="space-y-2 lg:hidden" aria-label="Company ID tag">
                <p className="text-xs font-medium tracking-wide text-muted uppercase">Company tag</p>
                <HomeIdCard user={user} placement="section" />
              </section>
            ) : null}
          </div>
        </div>

        {showIdCard ? <div className="pointer-events-none hidden lg:block" aria-hidden /> : null}
      </div>
    </div>
  );
}

function homeTitle(today: DailyWorkToday | null) {
  if (!today) {
    return 'Checking…';
  }
  if (today.state === 'SUBMITTED' || today.state === 'SUBMITTED_EDITABLE') {
    return 'Submitted';
  }
  if (today.state === 'OPEN') {
    return 'Open now';
  }
  if (today.state === 'LATE_AVAILABLE') {
    return 'Late submission available';
  }
  if (today.state === 'MISSED') {
    return 'Missed';
  }
  return 'Not submitted';
}

function homeDetail(today: DailyWorkToday | null) {
  if (!today) {
    return 'Loading the submission window.';
  }
  if (
    (today.state === 'SUBMITTED' || today.state === 'SUBMITTED_EDITABLE') &&
    today.entry?.submittedAt
  ) {
    return `Submitted at ${new Intl.DateTimeFormat('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: today.timezone,
    }).format(new Date(today.entry.submittedAt))}`;
  }
  return `Opens at ${formatClockLabel(today.settings.startTime)}`;
}

function HomeBadge({ today }: { today: DailyWorkToday | null }) {
  if (!today) {
    return <Badge tone="neutral">…</Badge>;
  }
  if (today.state === 'SUBMITTED' || today.state === 'SUBMITTED_EDITABLE') {
    return <Badge tone="sage">Submitted</Badge>;
  }
  if (today.state === 'OPEN') {
    return <Badge tone="sage">Open</Badge>;
  }
  if (today.state === 'LATE_AVAILABLE') {
    return <Badge tone="amber">Late</Badge>;
  }
  if (today.state === 'MISSED') {
    return <Badge tone="rose">Missed</Badge>;
  }
  return <Badge tone="amber">Pending</Badge>;
}
