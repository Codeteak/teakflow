import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'ghost' | 'outline' | 'soft';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
};

const variants: Record<Variant, string> = {
  primary: 'bg-sage text-surface hover:bg-sage-hover',
  ghost: 'bg-transparent text-ink hover:bg-line/60',
  outline: 'bg-transparent text-ink border border-line hover:bg-surface',
  soft: 'bg-sage-soft text-sage hover:bg-sage-soft/80',
};

export function buttonClassName(variant: Variant = 'primary', className?: string) {
  return cn(
    'inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium',
    'disabled:pointer-events-none disabled:opacity-40',
    variants[variant],
    className,
  );
}

export function Button({ variant = 'primary', className, children, ...props }: Props) {
  return (
    <button className={buttonClassName(variant, className)} {...props}>
      {children}
    </button>
  );
}
