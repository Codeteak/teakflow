import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Meeting } from '@teakflow/shared';
import { EmptyState, ErrorBanner, PageLoading } from '@/components/ui/page-state';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { GoogleMeetIcon } from '@/components/ui/google-meet-icon';
import { RightPanel } from '@/components/ui/right-panel';
import { CreateMeetingForm } from '@/components/meetings/CreateMeetingForm';
import { joinMeetingRequest, listMeetingsRequest } from '@/features/meetings/api';

function formatWhen(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function MeetingsPage() {
  const [params] = useSearchParams();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [panelOpen, setPanelOpen] = useState(Boolean(params.get('with') || params.get('conversationId')));

  const conversationId = params.get('conversationId');
  const withUser = params.get('with');

  async function load() {
    const rows = await listMeetingsRequest();
    setMeetings(rows);
  }

  useEffect(() => {
    let cancelled = false;
    load()
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Unable to load meetings.');
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
  }, []);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return [...meetings].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime() || a.title.localeCompare(b.title)).map((meeting) => ({
      meeting,
      past: new Date(meeting.endTime).getTime() < now,
    }));
  }, [meetings]);

  async function join(id: string) {
    try {
      const result = await joinMeetingRequest(id);
      window.open(result.googleMeetUrl, '_blank', 'noopener,noreferrer');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to join the meeting.');
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Meetings</h1>
          <p className="mt-1 text-sm text-muted">Google Meet only. No custom video stack.</p>
        </div>
        <Button type="button" onClick={() => setPanelOpen(true)}>
          Create meeting
        </Button>
      </header>

      {loading ? <PageLoading rows={3} /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {!loading && upcoming.length === 0 ? (
        <EmptyState
          title="No meetings yet"
          description="Create one to get a Google Meet link for your team."
          className="rounded-lg border border-line bg-surface"
        />
      ) : null}

      <div className="space-y-3">
        {upcoming.map(({ meeting, past }) => (
          <Card key={meeting.id} className={past ? 'opacity-70' : undefined}>
            <div className="flex items-start gap-3">
              <GoogleMeetIcon size={22} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs text-muted">{formatWhen(meeting.startTime)}</p>
                <h2 className="mt-1 text-lg font-semibold">{meeting.title}</h2>
                <p className="mt-2 text-sm text-muted">
                  {meeting.participants.length} participant{meeting.participants.length === 1 ? '' : 's'}
                  {meeting.createdByName ? ` · ${meeting.createdByName}` : ''}
                </p>
                {meeting.googleMeetUrl ? (
                  <a
                    href={meeting.googleMeetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex max-w-full items-center gap-1.5 truncate text-xs text-muted hover:text-ink"
                  >
                    <GoogleMeetIcon size={14} />
                    <span className="truncate font-mono">{meeting.googleMeetUrl}</span>
                  </a>
                ) : null}
              </div>
            </div>
            <Button variant="outline" className="mt-5 w-full sm:w-auto" type="button" onClick={() => void join(meeting.id)}>
              <GoogleMeetIcon size={16} />
              Join Google Meet
            </Button>
          </Card>
        ))}
      </div>

      <RightPanel open={panelOpen} title="Create meeting" onClose={() => setPanelOpen(false)}>
        <CreateMeetingForm
          conversationId={conversationId}
          preselectedUserId={withUser}
          onCreated={() => {
            setPanelOpen(false);
            setError('');
            void load();
          }}
        />
      </RightPanel>
    </div>
  );
}
