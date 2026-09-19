import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import {
  CONVERSATION_TYPE,
  type MessageSearchResult,
  type PublicUser,
} from '@teakflow/shared';
import { Avatar } from '@/components/ui/avatar';
import { createConversationRequest, searchMessagesRequest } from '@/features/chat/api';

export function GlobalSearchBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const isEmployees = location.pathname.startsWith('/employees');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<MessageSearchResult | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyPersonId, setBusyPersonId] = useState<string | null>(null);

  useEffect(() => {
    return () => window.clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    window.clearTimeout(timerRef.current);
    setHits(null);
    setOpen(false);
    setLoading(false);
    if (isEmployees) {
      setQuery(new URLSearchParams(location.search).get('q') ?? '');
      return;
    }
    setQuery('');
  }, [isEmployees, location.pathname, location.search]);

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  function onQueryChange(value: string) {
    setQuery(value);
    if (isEmployees) {
      const next = new URLSearchParams(params);
      if (value.trim()) {
        next.set('q', value);
      } else {
        next.delete('q');
      }
      setParams(next, { replace: true });
      setOpen(false);
      setHits(null);
      setLoading(false);
      return;
    }
    setOpen(true);
    window.clearTimeout(timerRef.current);
    if (value.trim().length < 2) {
      setHits(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    timerRef.current = window.setTimeout(() => {
      void searchMessagesRequest({ q: value.trim() })
        .then((result) => {
          setHits(result);
          setOpen(true);
        })
        .catch(() => setHits(null))
        .finally(() => setLoading(false));
    }, 250);
  }

  function clear() {
    setQuery('');
    setHits(null);
    setOpen(false);
    setLoading(false);
    if (isEmployees) {
      const next = new URLSearchParams(params);
      next.delete('q');
      setParams(next, { replace: true });
    }
  }

  async function openPerson(person: PublicUser) {
    setBusyPersonId(person.id);
    try {
      const conversation = await createConversationRequest({
        type: CONVERSATION_TYPE.DIRECT,
        userId: person.id,
      });
      clear();
      navigate(`/chat/${conversation.id}`);
    } catch {
      setBusyPersonId(null);
    }
  }

  function openMessage(conversationId: string) {
    clear();
    navigate(`/chat/${conversationId}`);
  }

  const suggestions = hits
    ? [...new Set([...hits.completions, ...hits.suggestions])].slice(0, 8)
    : [];
  const showPanel = !isEmployees && open && query.trim().length >= 2;

  return (
    <div ref={rootRef} className="relative w-full">
      <div className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-muted">
        <Search size={14} className="shrink-0" strokeWidth={1.75} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onFocus={() => {
            if (!isEmployees && query.trim().length >= 2) setOpen(true);
          }}
          className="global-search-input min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted/80"
          placeholder={isEmployees ? 'Search people' : 'Search people and messages'}
          aria-label={isEmployees ? 'Search people' : 'Search people and messages'}
          autoComplete="off"
        />
        {query ? (
          <button
            type="button"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-line/60 hover:text-ink"
            aria-label="Clear search"
            onClick={clear}
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        ) : null}
      </div>

      {showPanel ? (
        <div className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-40 overflow-hidden rounded-xl border border-line bg-surface">
          <div className="h-72 overflow-y-auto overscroll-contain scrollbar-none">
            {loading && !hits ? (
              <p className="px-3 py-4 text-sm text-muted">Searching…</p>
            ) : null}

            {hits?.correctedQuery ? (
              <p className="border-b border-line px-3 py-2 text-xs text-muted">
                Showing spelling close to{' '}
                <span className="font-medium text-ink">{hits.correctedQuery}</span>
              </p>
            ) : null}

            {suggestions.length > 0 ? (
              <div className="flex flex-wrap gap-1 border-b border-line px-3 py-2">
                {suggestions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="rounded-md border border-line bg-paper px-2 py-1 text-xs text-ink hover:bg-line/50"
                    onClick={() => onQueryChange(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            ) : null}

            {hits && hits.people.length > 0 ? (
              <section className="border-b border-line py-1.5">
                <p className="px-3 pb-1 pt-1 text-[11px] font-medium tracking-wide text-muted uppercase">
                  People
                </p>
                {hits.people.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    disabled={busyPersonId === person.id}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-line/50 disabled:opacity-60"
                    onClick={() => void openPerson(person)}
                  >
                    <Avatar name={person.name} src={person.avatar} size={28} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">
                        {person.name}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {person.designation ?? person.role}
                        {person.department ? ` · ${person.department}` : ''}
                      </span>
                    </span>
                  </button>
                ))}
              </section>
            ) : null}

            {hits ? (
              <section className="py-1.5">
                <p className="px-3 pb-1 pt-1 text-[11px] font-medium tracking-wide text-muted uppercase">
                  Messages
                </p>
                {hits.items.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted">No message matches.</p>
                ) : (
                  hits.items.map((hit) => (
                    <button
                      key={hit.message.id}
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-line/50"
                      onClick={() => openMessage(hit.conversationId)}
                    >
                      <span className="block truncate text-sm font-medium text-ink">
                        {hit.conversationName}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {hit.message.content}
                      </span>
                    </button>
                  ))
                )}
              </section>
            ) : null}

            {!loading && hits && hits.people.length === 0 && hits.items.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted">No people or messages found.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
