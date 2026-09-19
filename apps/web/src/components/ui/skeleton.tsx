import { cn } from '@/lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return <span className={cn('skeleton inline-block rounded-md bg-line', className)} />;
}
