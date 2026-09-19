import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function RightPanel({ open, title, onClose, children }: Props) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-40',
        open ? 'pointer-events-auto' : 'pointer-events-none',
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        className={cn(
          'absolute inset-0 bg-ink/20 duration-[160ms] ease-out-soft',
          open ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
        tabIndex={open ? 0 : -1}
        aria-label="Close panel"
      />
      <aside
        className={cn(
          'absolute inset-y-0 right-0 flex w-full max-w-[400px] flex-col border-l border-line bg-surface pt-[env(safe-area-inset-top)] duration-[160ms] ease-out-soft',
          open ? 'opacity-100' : 'opacity-0',
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="right-panel-title"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id="right-panel-title" className="text-base font-semibold tracking-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted hover:bg-line/60 hover:text-ink"
            aria-label="Close"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}
