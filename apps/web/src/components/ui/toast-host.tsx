import { useToastStore } from '@/store/toast';

export function ToastHost() {
  const items = useToastStore((state) => state.items);
  const dismiss = useToastStore((state) => state.dismiss);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[70] flex w-[min(22rem,calc(100vw-1.5rem))] flex-col gap-2 md:right-6 md:bottom-6">
      {items.map((item) => (
        <div
          key={item.id}
          className="pointer-events-auto overflow-hidden rounded-xl border border-line bg-surface"
          role="status"
        >
          <div className="flex items-start gap-3 px-4 py-3">
            <span
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                item.status === 'progress' ? 'bg-sage' : item.status === 'success' ? 'bg-sage' : 'bg-rose'
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{item.title}</p>
              {item.detail ? <p className="mt-0.5 text-xs leading-5 text-muted">{item.detail}</p> : null}
            </div>
            {item.status !== 'progress' ? (
              <button
                type="button"
                className="rounded-md px-1 text-xs text-muted hover:text-ink"
                onClick={() => dismiss(item.id)}
              >
                Close
              </button>
            ) : null}
          </div>
          {item.status === 'progress' ? (
            <div className="h-0.5 overflow-hidden bg-line">
              <div className="toast-progress-bar h-full w-1/3 bg-sage" />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
