import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { USER_STATUS, type PublicUser } from '@teakflow/shared';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/cn';

function matchesQuery(person: PublicUser, needle: string) {
  if (!needle) {
    return false;
  }
  return [person.name, person.email, person.designation, person.department, person.role]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(needle));
}

function personMeta(person: PublicUser) {
  const parts = [person.designation, person.department].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : person.role;
}

type SharedProps = {
  people: PublicUser[];
  excludeIds?: string[];
  placeholder?: string;
  emptyHint?: string;
  className?: string;
};

type SingleProps = SharedProps & {
  mode: 'single';
  onSelect: (person: PublicUser) => void;
};

type MultiProps = SharedProps & {
  mode: 'multi';
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

export type PeopleSearchPickerProps = SingleProps | MultiProps;

export function PeopleSearchPicker(props: PeopleSearchPickerProps) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const excluded = useMemo(() => new Set(props.excludeIds ?? []), [props.excludeIds]);

  const pool = useMemo(
    () =>
      props.people.filter(
        (person) => person.status === USER_STATUS.ACTIVE && !excluded.has(person.id),
      ),
    [excluded, props.people],
  );

  const selectedPeople = useMemo(() => {
    if (props.mode !== 'multi') {
      return [];
    }
    const selected = new Set(props.selectedIds);
    return props.people.filter((person) => selected.has(person.id));
  }, [props]);

  const matches = useMemo(() => {
    if (!needle) {
      return [];
    }
    return pool.filter((person) => matchesQuery(person, needle)).slice(0, 40);
  }, [needle, pool]);

  function toggle(id: string) {
    if (props.mode !== 'multi') {
      return;
    }
    props.onChange(
      props.selectedIds.includes(id)
        ? props.selectedIds.filter((value) => value !== id)
        : [...props.selectedIds, id],
    );
  }

  return (
    <div className={cn('space-y-2', props.className)}>
      {props.mode === 'multi' && selectedPeople.length > 0 ? (
        <div className="flex max-h-20 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-line bg-paper p-2">
          {selectedPeople.map((person) => (
            <button
              key={person.id}
              type="button"
              className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink hover:bg-line/50"
              onClick={() => toggle(person.id)}
              title={`Remove ${person.name}`}
            >
              <Avatar name={person.name} src={person.avatar} size={18} />
              <span className="truncate">{person.name.split(' ')[0]}</span>
              <X size={12} className="shrink-0 text-muted" />
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex h-10 items-center gap-2 rounded-md border border-line bg-surface px-3 text-sm text-muted">
        <Search size={14} className="shrink-0" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full bg-transparent text-sm text-ink outline-none"
          placeholder={props.placeholder ?? 'Search people by name'}
          autoComplete="off"
        />
        {query ? (
          <button
            type="button"
            className="rounded p-0.5 text-muted hover:text-ink"
            aria-label="Clear search"
            onClick={() => setQuery('')}
          >
            <X size={14} />
          </button>
        ) : null}
      </div>

      <div className="h-44 overflow-y-auto rounded-md border border-line bg-surface scrollbar-none">
        {!needle ? (
          <p className="px-3 py-6 text-center text-xs text-muted">
            {props.emptyHint ?? 'Type a name to find people. Everyone in the company is searchable.'}
          </p>
        ) : matches.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted">No people match “{query.trim()}”.</p>
        ) : (
          <ul className="divide-y divide-line">
            {matches.map((person) => {
              if (props.mode === 'single') {
                return (
                  <li key={person.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-line/40"
                      onClick={() => {
                        props.onSelect(person);
                        setQuery('');
                      }}
                    >
                      <Avatar name={person.name} src={person.avatar} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{person.name}</span>
                        <span className="block truncate text-xs text-muted">{personMeta(person)}</span>
                      </span>
                    </button>
                  </li>
                );
              }

              const checked = props.selectedIds.includes(person.id);
              return (
                <li key={person.id}>
                  <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2.5 hover:bg-line/40">
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 accent-sage"
                      checked={checked}
                      onChange={() => toggle(person.id)}
                    />
                    <Avatar name={person.name} src={person.avatar} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{person.name}</span>
                      <span className="block truncate text-xs text-muted">{personMeta(person)}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
