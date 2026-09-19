import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Bell } from 'lucide-react';
import { NOTIFICATION_TYPE, type AppNotification } from '@teakflow/shared';
import { CountBadge } from '@/components/ui/count-badge';
import {
  NotificationPanel,
  type NotificationItem,
} from '@/components/ui/notification-panel';
import {
  listNotificationsRequest,
  markAllNotificationsReadRequest,
  markNotificationReadRequest,
} from '@/features/chat/api';
import {
  mapAppNotifications,
  readArchivedIds,
  writeArchivedIds,
} from '@/features/notifications/mapNotifications';
import { shouldSuppressChatAlert } from '@/features/chat/activeConversation';
import { cn } from '@/lib/cn';
import { subscribeChatSocket } from '@/services/socket/chat';
import { useNotificationUnreadStore } from '@/store/notificationUnread';

const EASE = [0.22, 1, 0.36, 1] as const;

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<AppNotification[]>([]);
  const [archivedIds, setArchivedIds] = useState(() => readArchivedIds());
  const [loading, setLoading] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const unread = useNotificationUnreadStore((state) => state.unread);
  const hydrate = useNotificationUnreadStore((state) => state.hydrate);
  const markAllReadStore = useNotificationUnreadStore((state) => state.markAllRead);
  const markOneReadStore = useNotificationUnreadStore((state) => state.markOneRead);

  const items = mapAppNotifications(rows, archivedIds);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    listNotificationsRequest()
      .then((next) => {
        if (!cancelled) {
          setRows(next);
          hydrate(next.filter((row) => !row.isRead).length);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrate, open]);

  useEffect(() => {
    return subscribeChatSocket({
      onNotification(notification) {
        if (shouldSuppressChatAlert(notification)) {
          void markNotificationReadRequest(notification.id).catch(() => undefined);
          return;
        }
        setRows((current) => [
          notification,
          ...current.filter((row) => row.id !== notification.id),
        ]);
      },
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target))
        return;
      setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  function syncUnread(nextRows: AppNotification[]) {
    hydrate(nextRows.filter((row) => !row.isRead && !archivedIds.has(row.id)).length);
  }

  async function onReadChange(item: NotificationItem, unreadNext: boolean) {
    setRows((current) => {
      const next = current.map((row) =>
        row.id === item.id ? { ...row, isRead: !unreadNext } : row,
      );
      syncUnread(next);
      return next;
    });
    if (!unreadNext) {
      markOneReadStore();
      await markNotificationReadRequest(item.id).catch(() => undefined);
    }
  }

  async function onMarkAllRead() {
    markAllReadStore();
    setRows((current) => current.map((row) => ({ ...row, isRead: true })));
    await markAllNotificationsReadRequest().catch(() => undefined);
  }

  function onArchiveChange(item: NotificationItem, archived: boolean) {
    setArchivedIds((current) => {
      const next = new Set(current);
      if (archived) next.add(item.id);
      else next.delete(item.id);
      writeArchivedIds(next);
      return next;
    });
    if (archived && item.unread) {
      void onReadChange(item, false);
    }
  }

  function onOpenItem(item: NotificationItem) {
    setOpen(false);
    const type = item.sourceType;
    if (
      type === NOTIFICATION_TYPE.MEETING_CREATED ||
      type === NOTIFICATION_TYPE.MEETING_REMINDER
    ) {
      navigate('/meetings');
      return;
    }
    if (
      type === NOTIFICATION_TYPE.DAILY_WORK_OPEN ||
      type === NOTIFICATION_TYPE.DAILY_WORK_REMINDER
    ) {
      navigate('/daily-work');
      return;
    }
    if (item.referenceId) {
      navigate(`/chat/${item.referenceId}`);
    }
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'relative inline-flex h-9 w-9 items-center justify-center rounded-md',
          open ? 'bg-sage-soft text-sage' : 'text-muted hover:bg-line/60 hover:text-ink',
        )}
      >
        <Bell size={18} strokeWidth={1.75} />
        <CountBadge count={unread} className="absolute -top-1 -right-1" />
      </button>

      {typeof document !== 'undefined'
        ? createPortal(
            <AnimatePresence>
              {open ? (
                <>
                  <button
                    type="button"
                    aria-label="Close notifications"
                    className="fixed inset-0 z-40 bg-ink/10 md:bg-transparent"
                    onClick={() => setOpen(false)}
                  />
                  <motion.div
                    ref={panelRef}
                    role="dialog"
                    aria-label="Notifications"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.16, ease: EASE }}
                    className="fixed top-14 right-3 z-50 w-[min(100vw-1.5rem,420px)] sm:right-5 md:right-8"
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    {loading && items.length === 0 ? (
                      <div className="rounded-lg border border-line bg-surface px-4 py-8 text-center text-sm text-muted">
                        Loading…
                      </div>
                    ) : (
                      <NotificationPanel
                        items={items}
                        maxHeight={Math.min(420, window.innerHeight - 120)}
                        onOpenItem={onOpenItem}
                        onReadChange={(item, nextUnread) =>
                          void onReadChange(item, nextUnread)
                        }
                        onArchiveChange={onArchiveChange}
                        onMarkAllRead={() => void onMarkAllRead()}
                        onSettings={() => {
                          setOpen(false);
                          navigate('/settings');
                        }}
                      />
                    )}
                  </motion.div>
                </>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </div>
  );
}
