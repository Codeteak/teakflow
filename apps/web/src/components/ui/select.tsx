import type { SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-11 w-full rounded-md border border-line bg-surface px-3.5 text-sm text-ink',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
