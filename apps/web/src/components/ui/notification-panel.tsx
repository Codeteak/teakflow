import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AtSign,
  Bell,
  Calendar,
  Check,
  CheckCheck,
  Inbox,
  MessageSquare,
  MoreHorizontal,
  NotebookPen,
  Settings2,
  Smile,
} from 'lucide-react';
import { cn } from '@/lib/cn';

/* Quiet Desk notification list: sentence-first rows, light motion, paper surface. */

const EASE = [0.22, 1, 0.36, 1] as const;
const FADE = { duration: 0.16, ease: EASE } as const;
const MENU_W = 176;
const MENU_GAP = 6;

export type NotificationKind =
  | 'mention'
  | 'message'
  | 'reaction'
  | 'meeting'
  | 'daily_work';

export type NotificationPiece = string | { entity: string };

export type NotificationItem = {
  id: string;
  actor: { name: string; avatar?: string | null };
  kind: NotificationKind;
  body: NotificationPiece[];
  time: string;
  context?: string[];
  unread?: boolean;
  archived?: boolean;
  quote?: string;
  referenceId?: string | null;
  sourceType?: string;
};

export type NotificationPanelProps = {
  items: NotificationItem[];
  onOpenItem?: (item: NotificationItem) => void;
  onReadChange?: (item: NotificationItem, unread: boolean) => void;
  onArchiveChange?: (item: NotificationItem, archived: boolean) => void;
  onMarkAllRead?: () => void;
  onSettings?: () => void;
  maxHeight?: number;
  className?: string;
};

const KIND_ICON: Record<NotificationKind, ComponentType<{ className?: string }>> = {
  mention: AtSign,
  message: MessageSquare,
  reaction: Smile,
  meeting: Calendar,
  daily_work: NotebookPen,
};

const KIND_TINT: Record<NotificationKind, string> = {
  mention: 'bg-sage text-surface',
  message: 'bg-ink text-surface',
  reaction: 'bg-amber text-surface',
  meeting: 'bg-sage text-surface',
  daily_work: 'bg-rose text-surface',
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase();
}

function AvatarBadge({ item }: { item: NotificationItem }) {
  const Icon = KIND_ICON[item.kind];
  return (
    <span className="relative block h-8 w-8 shrink-0">
      {item.actor.avatar ? (
        <img
          src={item.actor.avatar}
          alt=""
          draggable={false}
          className="h-8 w-8 rounded-full border border-line object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="grid h-8 w-8 place-items-center rounded-full border border-line bg-sage-soft text-[11px] font-semibold text-sage"
        >
          {initials(item.actor.name)}
        </span>
      )}
      <span
        aria-hidden
        className={cn(
          'absolute -right-0.5 -bottom-0.5 grid h-[15px] w-[15px] place-items-center rounded-full ring-2 ring-surface',
          KIND_TINT[item.kind],
        )}
      >
        <Icon className="h-[9px] w-[9px]" />
      </span>
    </span>
  );
}

function RowMenu({
  unread,
  archived,
  onRead,
  onArchive,
}: {
  unread: boolean;
  archived: boolean;
  onRead: () => void;
  onArchive: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState({ top: 0, left: 0, above: false });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const scroller = useCallback(() => {
    let el = triggerRef.current?.parentElement ?? null;
    while (el) {
      const o = getComputedStyle(el).overflowY;
      if ((o === 'auto' || o === 'scroll') && el.scrollHeight > el.clientHeight) return el;
      el = el.parentElement;
    }
    return null;
  }, []);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) {
      setOpen(false);
      return;
    }
    const r = trigger.getBoundingClientRect();
    const listBox = scroller()?.getBoundingClientRect();
    if (listBox && (r.bottom < listBox.top + 4 || r.top > listBox.bottom - 4)) {
      setOpen(false);
      return;
    }
    const height = menuRef.current?.offsetHeight ?? 76;
    const panel = trigger.closest('[data-notification-panel]')?.getBoundingClientRect();
    const lowest = Math.min(panel?.bottom ?? window.innerHeight, window.innerHeight - 8);
    const highest = Math.max(panel?.top ?? 0, 8);
    const fitsBelow = r.bottom + MENU_GAP + height <= lowest;
    const fitsAbove = r.top - MENU_GAP - height >= highest;
    const above = !fitsBelow && fitsAbove;
    let top = above ? r.top - MENU_GAP - height : r.bottom + MENU_GAP;
    if (!fitsBelow && !fitsAbove) top = Math.max(highest, lowest - height);
    top = Math.min(Math.max(top, 8), Math.max(8, window.innerHeight - height - 8));
    setBox({
      top,
      left: Math.max(8, Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8)),
      above,
    });
  }, [scroller]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !triggerRef.current?.contains(t)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const move = () => place();
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    window.addEventListener('scroll', move, true);
    window.addEventListener('resize', move);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', key);
      window.removeEventListener('scroll', move, true);
      window.removeEventListener('resize', move);
    };
  }, [open, place]);

  const itemClass =
    'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12.5px] text-ink transition-colors hover:bg-line/60';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Row options"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={cn(
          'grid h-6 w-6 place-items-center rounded-md transition-colors hover:bg-line/60 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/30',
          open ? 'bg-line/60 text-ink' : 'text-muted opacity-70 group-hover/row:opacity-100 focus-visible:opacity-100',
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {typeof document !== 'undefined'
        ? createPortal(
            <AnimatePresence>
              {open ? (
                <motion.div
                  ref={menuRef}
                  role="menu"
                  onPointerDown={(e: ReactPointerEvent) => e.stopPropagation()}
                  initial={{ opacity: 0, y: box.above ? 4 : -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: box.above ? 4 : -4 }}
                  transition={FADE}
                  style={{
                    position: 'fixed',
                    top: box.top,
                    left: box.left,
                    width: MENU_W,
                  }}
                  className={cn(
                    'z-[70] rounded-lg border border-line bg-surface p-1',
                    box.above ? 'origin-bottom-right' : 'origin-top-right',
                  )}
                >
                  <button
                    type="button"
                    role="menuitem"
                    className={itemClass}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRead();
                      setOpen(false);
                    }}
                  >
                    <Check className="h-3.5 w-3.5 text-muted" />
                    {unread ? 'Mark as read' : 'Mark as unread'}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={itemClass}
                    onClick={(e) => {
                      e.stopPropagation();
                      onArchive();
                      setOpen(false);
                    }}
                  >
                    <Inbox className="h-3.5 w-3.5 text-muted" />
                    {archived ? 'Move to inbox' : 'Archive'}
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  );
}

function Sentence({ actor, body }: { actor: string; body: NotificationPiece[] }) {
  return (
    <p className="m-0 text-[13px] leading-[1.45] text-muted">
      <span className="font-medium text-ink">{actor}</span>{' '}
      {body.map((piece, i) =>
        typeof piece === 'string' ? (
          <span key={i}>{piece}</span>
        ) : (
          <span key={i} className="font-medium text-ink">
            {piece.entity}
          </span>
        ),
      )}
    </p>
  );
}

function Row({
  item,
  onOpen,
  onRead,
  onArchive,
}: {
  item: NotificationItem;
  onOpen: () => void;
  onRead: () => void;
  onArchive: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e: ReactKeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        'group/row relative flex w-full cursor-default gap-3 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sage/30',
        item.unread ? 'bg-sage-soft/40 hover:bg-sage-soft/70' : 'hover:bg-line/40',
      )}
    >
      <AvatarBadge item={item} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Sentence actor={item.actor.name} body={item.body} />
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[11px] text-muted">
              <span>{item.time}</span>
              {item.context?.length ? (
                <>
                  <span aria-hidden className="text-line">
                    ·
                  </span>
                  <span className="truncate">{item.context.join(' / ')}</span>
                </>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
            <RowMenu unread={!!item.unread} archived={!!item.archived} onRead={onRead} onArchive={onArchive} />
            {item.unread ? (
              <span aria-label="Unread" className="mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full bg-sage" />
            ) : (
              <span className="h-[7px] w-[7px] shrink-0" />
            )}
          </div>
        </div>
        {item.quote ? (
          <p className="m-0 mt-2 rounded-md bg-paper px-2.5 py-1.5 text-[12.5px] leading-[1.5] text-muted">
            “{item.quote}”
          </p>
        ) : null}
      </div>
    </div>
  );
}

type TabId = 'inbox' | 'all' | 'archived';

const TABS: { id: TabId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'archived', label: 'Archived' },
];

export const NotificationPanel = forwardRef<HTMLDivElement, NotificationPanelProps>(
  function NotificationPanel(
    {
      items,
      onOpenItem,
      onReadChange,
      onArchiveChange,
      onMarkAllRead,
      onSettings,
      maxHeight = 420,
      className,
    },
    ref,
  ) {
    const reduced = useReducedMotion();
    const [tab, setTab] = useState<TabId>('all');
    const [state, setState] = useState(items);

    useEffect(() => setState(items), [items]);

    const patch = (id: string, next: Partial<NotificationItem>) =>
      setState((list) => list.map((n) => (n.id === id ? { ...n, ...next } : n)));

    const shown = useMemo(() => {
      switch (tab) {
        case 'inbox':
          return state.filter((n) => !n.archived && n.unread);
        case 'archived':
          return state.filter((n) => n.archived);
        default:
          return state.filter((n) => !n.archived);
      }
    }, [state, tab]);

    const unread = state.filter((n) => n.unread && !n.archived).length;
    const counts: Record<TabId, number> = {
      inbox: unread,
      all: 0,
      archived: 0,
    };

    return (
      <div
        ref={ref}
        data-notification-panel=""
        className={cn(
          'w-full max-w-[420px] overflow-hidden rounded-lg border border-line bg-surface text-ink',
          className,
        )}
      >
        <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-0.5">
          <h2 className="m-0 text-[15px] font-semibold tracking-tight">Notifications</h2>
          <button
            type="button"
            onClick={() => {
              setState((list) => list.map((n) => ({ ...n, unread: false })));
              onMarkAllRead?.();
            }}
            disabled={unread === 0}
            className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12.5px] font-medium text-muted transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-40"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all as read
          </button>
        </div>

        <div className="flex items-center gap-1 border-b border-line px-3">
          <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none]">
            {TABS.map((t) => {
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative shrink-0 px-2 py-2.5 text-[13px] font-medium transition-colors',
                    active ? 'text-ink' : 'text-muted hover:text-ink',
                  )}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {t.label}
                    {counts[t.id] > 0 ? (
                      <span className="rounded-full bg-sage px-1.5 py-px text-[10.5px] font-semibold text-surface">
                        {counts[t.id]}
                      </span>
                    ) : null}
                  </span>
                  {active ? (
                    <motion.span
                      layoutId="notif-tab"
                      transition={reduced ? { duration: 0 } : FADE}
                      className="absolute inset-x-1.5 -bottom-px h-[2px] rounded-full bg-sage"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
          {onSettings ? (
            <button
              type="button"
              aria-label="Notification settings"
              onClick={onSettings}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-line/60 hover:text-ink"
            >
              <Settings2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div
          style={{ maxHeight }}
          className="divide-y divide-line overflow-y-auto [scrollbar-width:thin]"
        >
          <AnimatePresence initial={false}>
            {shown.map((item) => (
              <motion.div
                key={item.id}
                layout={!reduced}
                initial={false}
                exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0, transition: { duration: 0.16 } }}
                transition={FADE}
              >
                <Row
                  item={item}
                  onOpen={() => {
                    if (item.unread) {
                      patch(item.id, { unread: false });
                      onReadChange?.(item, false);
                    }
                    onOpenItem?.(item);
                  }}
                  onRead={() => {
                    patch(item.id, { unread: !item.unread });
                    onReadChange?.(item, !item.unread);
                  }}
                  onArchive={() => {
                    patch(item.id, { archived: !item.archived, unread: false });
                    onArchiveChange?.(item, !item.archived);
                  }}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {shown.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-paper text-muted">
                <Bell className="h-[18px] w-[18px]" />
              </span>
              <p className="m-0 text-[13px] font-medium text-ink">
                {tab === 'archived' ? 'Nothing archived' : 'You are all caught up'}
              </p>
              <p className="m-0 text-[12.5px] text-muted">
                {tab === 'archived' ? 'Rows you archive land here.' : 'New activity will show up here.'}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    );
  },
);
