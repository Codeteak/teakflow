import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn('rounded-lg border border-line bg-surface p-5', className)}>
      {children}
    </section>
  );
}
