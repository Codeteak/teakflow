import { cn } from '@/lib/cn';

type Props = {
  size?: number;
  className?: string;
};

/** Official Google Meet mark from `/public/icons/Google_Meet_icon.svg`. */
export function GoogleMeetIcon({ size = 18, className }: Props) {
  return (
    <img
      src="/icons/Google_Meet_icon.svg"
      alt=""
      width={size}
      height={Math.round(size * 0.78)}
      className={cn('inline-block shrink-0 object-contain', className)}
      aria-hidden
    />
  );
}
