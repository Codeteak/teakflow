import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui/skeleton';

export function ErrorBanner({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  if (!message) {
    return null;
  }
  return (
    <p
      role="alert"
      className={cn(
        'rounded-md border border-rose/30 bg-rose/5 px-3 py-2 text-sm text-rose',
        className,
      )}
    >
      {message}
    </p>
  );
}

export function EmptyState({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn('px-4 py-8 text-center', className)}>
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      {children}
    </div>
  );
}

export function PageLoading({
  rows = 4,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn('space-y-3', className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="space-y-2 rounded-lg border border-line bg-surface p-4"
        >
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
          {index % 2 === 0 ? <Skeleton className="h-3 w-1/2" /> : null}
        </div>
      ))}
    </div>
  );
}

export function ListLoading({
  rows = 5,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('space-y-1 px-2', className)}
      aria-busy="true"
      aria-label="Loading"
    >
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-md px-2 py-2.5">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
