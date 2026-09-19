import { useState } from 'react';
import { cn } from '@/lib/cn';

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase();
}

export function Avatar({
  name,
  src,
  size = 40,
  className,
  status,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
  /** Presence indicator on the avatar (chat header, etc.). */
  status?: 'online' | 'away' | 'dnd' | 'offline';
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;
  const dot = Math.max(8, Math.round(size * 0.28));
  const statusLabel =
    status === 'online'
      ? 'Online'
      : status === 'away'
        ? 'Away'
        : status === 'dnd'
          ? 'Do not disturb'
          : status === 'offline'
            ? 'Offline'
            : undefined;

  return (
    <span
      className={cn('relative inline-flex shrink-0', className)}
      style={{ width: size, height: size }}
    >
      <span
        className="inline-flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-line bg-sage-soft text-xs font-medium text-sage"
        aria-hidden
      >
        {showImage ? (
          <img
            src={src ?? undefined}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          initials(name)
        )}
      </span>
      {status ? (
        <span
          className={cn(
            'absolute right-0 bottom-0 rounded-full ring-2 ring-surface',
            status === 'online' && 'bg-[#2F9B64]',
            status === 'away' && 'bg-amber',
            status === 'dnd' && 'bg-rose',
            status === 'offline' && 'bg-muted',
          )}
          style={{ width: dot, height: dot }}
          title={statusLabel}
          aria-label={statusLabel}
        />
      ) : null}
    </span>
  );
}
