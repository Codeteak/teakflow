import { useEffect, useState, type FormEvent } from 'react';
import {
  CHANNEL_VISIBILITY,
  CONVERSATION_TYPE,
  DEPARTMENTS,
  type Conversation,
  type Department,
  type PublicUser,
} from '@teakflow/shared';
import { PeopleSearchPicker } from '@/components/chat/PeopleSearchPicker';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorBanner, PageLoading } from '@/components/ui/page-state';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/auth';
import {
  createConversationRequest,
  deleteChannelRequest,
  listManagedChannelsRequest,
} from '@/features/chat/api';
import { listUsersRequest } from '@/features/employees/api';

export function ChannelsPage() {
  const session = useAuthStore((state) => state.user);
  const [channels, setChannels] = useState<Conversation[]>([]);
  const [people, setPeople] = useState<PublicUser[]>([]);
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [department, setDepartment] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const [list, users] = await Promise.all([
      listManagedChannelsRequest(),
      listUsersRequest(),
    ]);
    setChannels(list);
    setPeople(users);
  }

  useEffect(() => {
    refresh()
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : 'Unable to load channels.'),
      )
      .finally(() => setLoading(false));
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await createConversationRequest({
        type: CONVERSATION_TYPE.CHANNEL,
        name: name.trim(),
        visibility:
          visibility === 'PUBLIC'
            ? CHANNEL_VISIBILITY.PUBLIC
            : CHANNEL_VISIBILITY.PRIVATE,
        memberIds: visibility === 'PRIVATE' ? memberIds : [],
        department:
          visibility === 'PUBLIC' && department ? (department as Department) : null,
      });
      setName('');
      setMemberIds([]);
      setDepartment('');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create channel.');
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Channels</h1>
        <p className="mt-1 text-sm text-muted">
          Public company channels include everyone (or one department). Private channels
          include only the people you pick. New hires join matching public rooms
          automatically.
        </p>
      </header>
      <form
        className="space-y-3 rounded-lg border border-line bg-surface p-5"
        onSubmit={(event) => void onCreate(event)}
      >
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Channel name"
        />
        <select
          className="h-11 w-full rounded-md border border-line bg-paper px-3 text-sm"
          value={visibility}
          onChange={(event) => setVisibility(event.target.value as 'PUBLIC' | 'PRIVATE')}
        >
          <option value="PUBLIC">Public</option>
          <option value="PRIVATE">Private</option>
        </select>
        {visibility === 'PUBLIC' ? (
          <>
            <select
              className="h-11 w-full rounded-md border border-line bg-paper px-3 text-sm"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
            >
              <option value="">Whole company</option>
              {DEPARTMENTS.map((item) => (
                <option key={item} value={item}>
                  {item} only
                </option>
              ))}
            </select>
            <p className="text-xs text-muted">
              {department
                ? `Everyone in ${department} is added now. New people in that department are added automatically.`
                : 'Every employee and manager is added now. New people are added automatically.'}
            </p>
          </>
        ) : (
          <div className="space-y-1.5">
            <p className="text-xs text-muted">Search and add anyone in the company.</p>
            <PeopleSearchPicker
              mode="multi"
              people={people}
              excludeIds={session?.id ? [session.id] : []}
              selectedIds={memberIds}
              onChange={setMemberIds}
              placeholder="Search people to add"
            />
          </div>
        )}
        <Button type="submit">Create channel</Button>
        {error ? <ErrorBanner message={error} /> : null}
      </form>
      {loading ? <PageLoading rows={3} /> : null}
      <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {!loading && channels.length === 0 ? (
          <EmptyState
            title="No channels yet"
            description="Create a public company channel or a private room."
          />
        ) : null}
        {channels.map((channel) => (
          <div key={channel.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">#{channel.name}</p>
              <p className="text-xs text-muted">
                {channel.visibility} · {channel.members.length} members
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void deleteChannelRequest(channel.id)
                  .then(() => refresh())
                  .catch((cause) =>
                    setError(
                      cause instanceof Error ? cause.message : 'Unable to delete.',
                    ),
                  )
              }
            >
              Delete
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
