import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

type Props = {
  open: boolean;
  dateLabel: string;
  dirty?: boolean;
  onClose: () => void;
  onSave?: () => void;
  onDiscard?: () => void;
  children: ReactNode;
  toolbar?: ReactNode;
  footer?: ReactNode;
};

export function NotebookModal({
  open,
  dateLabel,
  dirty = false,
  onClose,
  onSave,
  onDiscard,
  children,
  toolbar,
  footer,
}: Props) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirming(false);
    }
  }, [open]);

  const requestClose = useCallback(() => {
    if (dirty) {
      setConfirming(true);
      return;
    }
    onClose();
  }, [dirty, onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (confirming) {
          setConfirming(false);
          return;
        }
        requestClose();
      }
    }

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirming, open, requestClose]);

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-stretch justify-center md:items-center md:px-4 md:py-4',
        open ? 'pointer-events-auto' : 'pointer-events-none',
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        className={cn(
          'absolute inset-0 hidden bg-ink/25 duration-[160ms] ease-out-soft md:block',
          open ? 'opacity-100' : 'opacity-0',
        )}
        onClick={requestClose}
        tabIndex={open ? 0 : -1}
        aria-label="Close notebook"
      />
      <article
        className={cn(
          'relative flex h-dvh w-full flex-col overflow-hidden border-line bg-surface duration-[160ms] ease-out-soft md:h-[min(960px,calc(100dvh-2rem))] md:max-w-[640px] md:rounded-[18px] md:border',
          open ? 'opacity-100' : 'opacity-0',
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notebook-title"
      >
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line px-3 md:h-auto md:px-5 md:py-3">
          <span className="hidden h-2.5 w-2.5 rounded-full bg-sage md:block" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
              Notebook
            </p>
            <h2 id="notebook-title" className="truncate font-mono text-sm text-ink">
              {dateLabel}
            </h2>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="rounded-md p-1.5 text-muted hover:bg-line/60 hover:text-ink"
            aria-label="Close"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </header>
        {toolbar ? (
          <div className="border-b border-line bg-surface px-3 py-2">{toolbar}</div>
        ) : null}
        <div className="relative min-h-0 flex-1 overflow-hidden bg-paper">{children}</div>
        {footer ? (
          <div className="border-t border-line bg-surface px-5 py-3">{footer}</div>
        ) : null}

        {confirming ? (
          <div className="absolute inset-0 z-10 flex items-end justify-center bg-ink/25 p-4 md:items-center">
            <div className="w-full max-w-sm rounded-lg border border-line bg-surface p-4">
              <p className="text-sm font-semibold text-ink">Save this note?</p>
              <p className="mt-1 text-sm text-muted">
                You typed something. Save it as a draft, or discard it.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setConfirming(false);
                    onDiscard?.();
                    onClose();
                  }}
                >
                  Discard
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setConfirming(false);
                    onSave?.();
                    onClose();
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </article>
    </div>,
    document.body,
  );
}
