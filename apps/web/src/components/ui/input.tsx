import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-md border border-line bg-surface px-3.5 text-sm text-ink',
        'placeholder:text-muted/80',
        className,
      )}
      {...props}
    />
  );
}
