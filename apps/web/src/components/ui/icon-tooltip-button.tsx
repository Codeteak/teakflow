import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  active?: boolean;
  children: ReactNode;
};

export function IconTooltipButton({
  label,
  active,
  className,
  children,
  ...props
}: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'group relative grid h-10 w-10 shrink-0 place-items-center rounded-md border border-line text-ink',
        'transition-colors duration-160 ease-[cubic-bezier(0.22,1,0.36,1)]',
        active ? 'bg-sage-soft text-sage' : 'bg-surface hover:bg-line/50',
        className,
      )}
      {...props}
    >
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2',
          'whitespace-nowrap rounded-md border border-line bg-surface px-2 py-1 text-xs font-medium text-ink',
          'opacity-0 transition-opacity duration-160 ease-[cubic-bezier(0.22,1,0.36,1)]',
          'group-hover:opacity-100 group-focus-visible:opacity-100',
        )}
      >
        {label}
      </span>
    </button>
  );
}
