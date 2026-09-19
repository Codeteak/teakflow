import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type Props = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  busy?: boolean;
  wide?: boolean;
  footer?: ReactNode;
  children: ReactNode;
};

export function FormModal({
  open,
  title,
  description,
  onClose,
  busy = false,
  wide = false,
  footer,
  children,
}: Props) {
  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) {
        onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, open, onClose]);

  if (typeof document === 'undefined' || !open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:px-4 sm:py-6">
      <button
        type="button"
        className="absolute inset-0 bg-ink/25 duration-[160ms] ease-out-soft"
        onClick={() => {
          if (!busy) {
            onClose();
          }
        }}
        aria-label="Close"
      />
      <article
        className={`relative flex max-h-[min(720px,calc(100dvh-1.5rem))] w-full flex-col overflow-hidden rounded-t-[18px] border border-line bg-surface sm:rounded-[18px] ${wide ? 'max-w-5xl' : 'max-w-lg'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-modal-title"
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id="form-modal-title" className="text-lg font-semibold tracking-tight">
              {title}
            </h2>
            {description ? (
              <p className="mt-0.5 text-sm text-muted">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md p-1.5 text-muted hover:bg-line/60 hover:text-ink disabled:opacity-40"
            aria-label="Close"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="shrink-0 border-t border-line bg-surface px-5 py-3">
            {footer}
          </div>
        ) : null}
      </article>
    </div>,
    document.body,
  );
}
