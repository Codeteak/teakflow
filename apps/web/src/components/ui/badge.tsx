import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'sage' | 'amber' | 'rose';

const tones: Record<Tone, string> = {
  neutral: 'bg-line/70 text-muted',
  sage: 'bg-sage-soft text-sage',
  amber: 'bg-amber-soft text-amber',
  rose: 'bg-rose-soft text-rose',
};

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
