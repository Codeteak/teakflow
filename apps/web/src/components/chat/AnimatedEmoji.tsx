import { useState } from 'react';
import { cn } from '@/lib/cn';
import { emojiToNotoCodepoint, notoAnimatedUrl } from '@/features/chat/notoEmoji';

export function AnimatedEmoji({
  emoji,
  size = 20,
  className,
  title,
}: {
  emoji: string;
  size?: number;
  className?: string;
  title?: string;
}) {
  const [failed, setFailed] = useState(false);
  const codepoint = emojiToNotoCodepoint(emoji);

  if (!codepoint || failed) {
    return (
      <span className={cn('inline-flex leading-none', className)} style={{ fontSize: size }} title={title}>
        {emoji}
      </span>
    );
  }

  return (
    <img
      src={notoAnimatedUrl(codepoint, 128)}
      alt={title ?? emoji}
      title={title}
      width={size}
      height={size}
      className={cn('inline-block', className)}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
