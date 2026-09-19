import { useEffect, useState, type MouseEvent } from 'react';
import { Mic } from 'lucide-react';
import { cn } from '@/lib/cn';

interface VoiceInputProps {
  listening?: boolean;
  disabled?: boolean;
  onStart?: () => void;
  onStop?: () => void;
}

export function VoiceInput({
  className,
  listening: listeningProp,
  disabled,
  onStart,
  onStop,
  onClick,
}: React.ComponentProps<'button'> & VoiceInputProps) {
  const [internalListening, setInternalListening] = useState(false);
  const [time, setTime] = useState(0);
  const listening = listeningProp ?? internalListening;

  useEffect(() => {
    if (!listening) {
      setTime(0);
      return;
    }
    const intervalId = window.setInterval(() => {
      setTime((t) => t + 1);
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [listening]);

  function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  function onClickHandler(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) {
      return;
    }
    onClick?.(event);
    if (listeningProp !== undefined) {
      if (listening) {
        onStop?.();
      } else {
        onStart?.();
      }
      return;
    }
    const next = !internalListening;
    setInternalListening(next);
    if (next) {
      onStart?.();
    } else {
      onStop?.();
    }
  }

  return (
    <button
      type="button"
      title={listening ? 'Stop voice' : 'Voice input'}
      aria-pressed={listening}
      disabled={disabled}
      className={cn(
        'inline-flex h-9 shrink-0 items-center justify-center rounded-full text-muted md:h-10',
        listening
          ? 'w-auto gap-1.5 bg-sage-soft px-2.5 text-sage'
          : 'w-9 hover:bg-paper hover:text-ink md:w-10',
        className,
      )}
      onClick={onClickHandler}
    >
      <Mic size={18} />
      {listening ? (
        <span className="font-mono text-[11px] tabular-nums">{formatTime(time)}</span>
      ) : null}
    </button>
  );
}
