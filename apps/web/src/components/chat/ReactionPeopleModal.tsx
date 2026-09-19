import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { MessageReactionCount, PublicUser } from '@teakflow/shared';
import { AnimatedEmoji } from '@/components/chat/AnimatedEmoji';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/cn';

export function ReactionPeopleModal({
  open,
  reactions,
  people,
  viewerId,
  initialReaction,
  onClose,
  onToggle,
}: {
  open: boolean;
  reactions: MessageReactionCount[];
  people: Map<string, PublicUser>;
  viewerId: string;
  initialReaction?: string;
  onClose: () => void;
  onToggle: (reaction: string) => void;
}) {
  const [selected, setSelected] = useState(
    initialReaction ?? reactions[0]?.reaction ?? '',
  );

  useEffect(() => {
    if (open) {
      setSelected(initialReaction ?? reactions[0]?.reaction ?? '');
    }
  }, [initialReaction, open, reactions]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  const active = reactions.find((row) => row.reaction === selected) ?? reactions[0];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-ink/25"
        aria-label="Close reactions"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reaction-people-title"
        className="relative flex max-h-[min(420px,calc(100dvh-3rem))] w-full max-w-sm flex-col overflow-hidden rounded-t-[18px] border border-line bg-surface sm:rounded-[18px]"
      >
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 id="reaction-people-title" className="text-sm font-semibold">
            Reactions
          </h2>
          <button
            type="button"
            className="rounded-md p-1.5 text-muted hover:bg-line/50 hover:text-ink"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </header>
        <div className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {reactions.map((row) => (
            <button
              key={row.reaction}
              type="button"
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs',
                row.reaction === active?.reaction
                  ? 'bg-sage-soft text-sage'
                  : 'text-muted hover:bg-line/50',
              )}
              onClick={() => setSelected(row.reaction)}
            >
              <AnimatedEmoji emoji={row.reaction} size={16} />
              {row.count}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {active?.userIds.map((userId) => {
            const person = people.get(userId);
            const mine = userId === viewerId;
            const name = mine ? 'You' : (person?.name ?? 'Employee');
            return (
              <button
                key={`${active.reaction}-${userId}`}
                type="button"
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-line/40"
                onClick={() => {
                  if (mine) {
                    onToggle(active.reaction);
                  }
                }}
              >
                <Avatar name={name} src={person?.avatar} size={32} />
                <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
                <AnimatedEmoji emoji={active.reaction} size={18} />
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
