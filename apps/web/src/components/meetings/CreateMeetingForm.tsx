import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { isTeamSupervisorRole, reportingTreeIds, ROLES, USER_STATUS, type CreateMeetingInput, type PublicUser } from '@teakflow/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { listUsersRequest } from '@/features/employees/api';
import { createMeetingRequest } from '@/features/meetings/api';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/store/auth';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toLocalInput(value: Date) {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function atDay(base: Date, daysAhead: number, hours: number, minutes: number) {
  const value = new Date(base.getFullYear(), base.getMonth(), base.getDate() + daysAhead, hours, minutes, 0, 0);
  return value;
}

function nextMonday(from: Date) {
  const day = from.getDay();
  const add = ((8 - day) % 7) || 7;
  return atDay(from, add, 10, 0);
}

function applySlot(start: Date, durationMinutes: number) {
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return { startLocal: toLocalInput(start), endLocal: toLocalInput(end) };
}

const DURATION_MINUTES = 60;

const whenTemplates = [
  {
    id: 'today-10',
    label: 'Today 10:00 AM',
    start: (now: Date) => atDay(now, 0, 10, 0),
  },
  {
    id: 'today-16',
    label: 'Today 4:00 PM',
    start: (now: Date) => atDay(now, 0, 16, 0),
  },
  {
    id: 'tomorrow-10',
    label: 'Tomorrow 10:00 AM',
    start: (now: Date) => atDay(now, 1, 10, 0),
  },
  {
    id: 'tomorrow-16',
    label: 'Tomorrow 4:00 PM',
    start: (now: Date) => atDay(now, 1, 16, 0),
  },
  {
    id: 'monday-10',
    label: 'Next Monday 10:00 AM',
    start: (now: Date) => nextMonday(now),
  },
];

type Props = {
  conversationId?: string | null;
  preselectedUserId?: string | null;
  onCreated: () => void;
};

export function CreateMeetingForm({ conversationId, preselectedUserId, onCreated }: Props) {
  const session = useAuthStore((state) => state.user);
  const [people, setPeople] = useState<PublicUser[]>([]);
  const [title, setTitle] = useState('');
  const [startLocal, setStartLocal] = useState(() => toLocalInput(new Date(Date.now() + 60 * 60 * 1000)));
  const [endLocal, setEndLocal] = useState(() => toLocalInput(new Date(Date.now() + 2 * 60 * 60 * 1000)));
  const [selected, setSelected] = useState<string[]>(preselectedUserId ? [preselectedUserId] : []);
  const [activeWhen, setActiveWhen] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void listUsersRequest()
      .then(setPeople)
      .catch(() => undefined);
  }, []);

  const others = useMemo(() => {
    const active = people.filter((person) => person.status === USER_STATUS.ACTIVE && person.id !== session?.id);
    if (session && isTeamSupervisorRole(session.role) && session.role !== ROLES.ADMIN) {
      const tree = reportingTreeIds(people, session.id);
      return active.filter((person) => tree.has(person.id));
    }
    return active;
  }, [people, session]);

  useEffect(() => {
    setSelected((current) => current.filter((id) => others.some((person) => person.id === id)));
  }, [others]);

  useEffect(() => {
    if (!preselectedUserId) {
      return;
    }
    if (!others.some((person) => person.id === preselectedUserId)) {
      return;
    }
    setSelected((current) => (current.includes(preselectedUserId) ? current : [...current, preselectedUserId]));
  }, [preselectedUserId, others]);

  function applyTemplate(id: string, start: Date) {
    const slot = applySlot(start, DURATION_MINUTES);
    setActiveWhen(id);
    setStartLocal(slot.startLocal);
    setEndLocal(slot.endLocal);
  }

  function togglePerson(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setPending(true);
    const payload: CreateMeetingInput = {
      title,
      participantUserIds: selected,
      startTime: new Date(startLocal).toISOString(),
      endTime: new Date(endLocal).toISOString(),
      conversationId: conversationId ?? null,
    };
    try {
      await createMeetingRequest(payload);
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create the meeting.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={(event) => void onSubmit(event)}>
      <label className="space-y-1.5">
        <span className="text-xs font-medium text-muted">Title</span>
        <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Frontend Discussion" required minLength={3} />
      </label>

      <div className="space-y-1.5">
        <span className="text-xs font-medium text-muted">When</span>
        <div className="flex flex-wrap gap-2">
          {whenTemplates.map((item) => (
            <Button
              key={item.id}
              type="button"
              variant={activeWhen === item.id ? 'soft' : 'outline'}
              className="h-8 px-3 text-xs"
              onClick={() => applyTemplate(item.id, item.start(new Date()))}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      <label className="space-y-1.5">
        <span className="text-xs font-medium text-muted">Start</span>
        <Input
          type="datetime-local"
          value={startLocal}
          onChange={(event) => {
            setActiveWhen(null);
            setStartLocal(event.target.value);
          }}
          required
        />
      </label>
      <label className="space-y-1.5">
        <span className="text-xs font-medium text-muted">End</span>
        <Input
          type="datetime-local"
          value={endLocal}
          onChange={(event) => {
            setActiveWhen(null);
            setEndLocal(event.target.value);
          }}
          required
        />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-muted">Participants</legend>
        {session && isTeamSupervisorRole(session.role) && session.role !== ROLES.ADMIN ? (
          <p className="text-xs text-muted">Only people in your reporting tree.</p>
        ) : null}
        {others.length === 0 ? (
          <p className="text-sm text-muted">
            {session && isTeamSupervisorRole(session.role) && session.role !== ROLES.ADMIN
              ? 'No one is in your reporting tree yet. Ask an admin to assign reports.'
              : 'No one else to invite.'}
          </p>
        ) : (
          <div className="max-h-52 space-y-1 overflow-y-auto rounded-md border border-line bg-surface p-2">
            {others.map((person) => {
              const checked = selected.includes(person.id);
              return (
                <label
                  key={person.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-line/40',
                    checked && 'bg-sage-soft',
                  )}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-sage"
                    checked={checked}
                    onChange={() => togglePerson(person.id)}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{person.name}</span>
                    <span className="block truncate text-xs text-muted">{person.designation ?? 'Employee'}</span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </fieldset>
      {error ? <p className="text-sm text-rose">{error}</p> : null}
      <Button type="submit" disabled={pending || selected.length === 0}>
        {pending ? 'Creating…' : 'Create Google Meet'}
      </Button>
    </form>
  );
}
