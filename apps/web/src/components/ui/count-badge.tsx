import { cn } from '@/lib/cn';

export function CountBadge({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count <= 0) {
    return null;
  }

  return (
    <span
      className={cn(
        'inline-flex min-w-4 items-center justify-center rounded-full bg-sage px-1 text-[10px] font-medium text-surface',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
