import { useEffect, useRef, useState } from 'react';
import { PRESENCE_STATUS, type PresenceStatus } from '@teakflow/shared';
import { cn } from '@/lib/cn';
import { emitPresence } from '@/services/socket/chat';
import { presenceLabel, usePresenceStore } from '@/store/presence';

const OPTIONS: PresenceStatus[] = [
  PRESENCE_STATUS.ONLINE,
  PRESENCE_STATUS.AWAY,
  PRESENCE_STATUS.DND,
];

function Dot({ status }: { status: PresenceStatus }) {
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 rounded-full',
        status === PRESENCE_STATUS.ONLINE && 'bg-[#2F9B64]',
        status === PRESENCE_STATUS.AWAY && 'bg-amber',
        status === PRESENCE_STATUS.DND && 'bg-rose',
        status === PRESENCE_STATUS.OFFLINE && 'bg-muted',
      )}
    />
  );
}

export function PresencePicker({ compact = false }: { compact?: boolean }) {
  const selfStatus = usePresenceStore((state) => state.selfStatus);
  const setSelfStatus = usePresenceStore((state) => state.setSelfStatus);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  function choose(status: PresenceStatus) {
    setSelfStatus(status);
    emitPresence(status);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={cn(
          'flex items-center gap-1.5 rounded-md text-left transition-colors duration-160',
          compact
            ? 'text-[11px] text-muted hover:text-ink'
            : 'w-full px-0 py-0 text-xs text-muted hover:text-ink',
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((value) => !value)}
      >
        <Dot status={selfStatus} />
        <span className="truncate">{presenceLabel(selfStatus)}</span>
      </button>
      {open ? (
        <div
          role="listbox"
          className="absolute bottom-full left-0 z-40 mb-1 min-w-[10.5rem] overflow-hidden rounded-md border border-line bg-surface py-1"
        >
          {OPTIONS.map((status) => (
            <button
              key={status}
              type="button"
              role="option"
              aria-selected={selfStatus === status}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors duration-160 hover:bg-paper',
                selfStatus === status ? 'text-sage' : 'text-ink',
              )}
              onClick={() => choose(status)}
            >
              <Dot status={status} />
              {presenceLabel(status)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
