import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function BubbleGroup({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1', className)} {...props} />;
}

export function Bubble({
  variant = 'default',
  align = 'start',
  className,
  ...props
}: ComponentProps<'div'> & {
  variant?: 'default' | 'muted';
  align?: 'start' | 'end';
}) {
  return (
    <div
      data-align={align}
      data-variant={variant}
      className={cn(
        'group/bubble relative flex w-fit max-w-[80%] min-w-0 flex-col gap-1',
        align === 'end' && 'self-end',
        variant === 'default' &&
          '[&_[data-slot=bubble-content]]:bg-sage [&_[data-slot=bubble-content]]:text-surface',
        variant === 'muted' &&
          '[&_[data-slot=bubble-content]]:bg-paper [&_[data-slot=bubble-content]]:text-ink',
        className,
      )}
      {...props}
    />
  );
}

export function BubbleContent({ className, style, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="bubble-content"
      className={cn(
        'w-fit max-w-full min-w-0 overflow-hidden rounded-[18px] px-3.5 py-2.5 text-sm leading-relaxed break-words',
        className,
      )}
      style={style}
      {...props}
    />
  );
}

export function BubbleReactions({
  side = 'bottom',
  align = 'end',
  className,
  children,
  ...props
}: ComponentProps<'div'> & {
  align?: 'start' | 'end';
  side?: 'top' | 'bottom';
  children?: ReactNode;
}) {
  return (
    <div
      data-slot="bubble-reactions"
      className={cn(
        'absolute z-10 flex h-6 min-w-[1.75rem] shrink-0 items-center justify-center gap-0.5 rounded-full bg-paper px-1.5 text-xs leading-none ring-2 ring-surface',
        side === 'top' ? 'top-0 -translate-y-1/2' : 'bottom-0 translate-y-1/2',
        align === 'end' ? 'right-1' : 'left-1',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
