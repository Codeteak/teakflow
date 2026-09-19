import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NOTIFICATION_TYPE, type AppNotification } from '@teakflow/shared';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorBanner, PageLoading } from '@/components/ui/page-state';
import {
  listNotificationsRequest,
  markAllNotificationsReadRequest,
  markNotificationReadRequest,
} from '@/features/chat/api';
import { shouldSuppressChatAlert } from '@/features/chat/activeConversation';
import { subscribeChatSocket } from '@/services/socket/chat';
import { useNotificationUnreadStore } from '@/store/notificationUnread';

export function NotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const markAllRead = useNotificationUnreadStore((state) => state.markAllRead);
  const markOneRead = useNotificationUnreadStore((state) => state.markOneRead);

  useEffect(() => {
    let cancelled = false;
    listNotificationsRequest()
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch((cause) => {
        if (!cancelled)
          setError(
            cause instanceof Error ? cause.message : 'Unable to load notifications.',
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const unsubscribe = subscribeChatSocket({
      onNotification(notification) {
        if (shouldSuppressChatAlert(notification)) {
          void markNotificationReadRequest(notification.id).catch(() => undefined);
          return;
        }
        setItems((current) => [
          notification,
          ...current.filter((row) => row.id !== notification.id),
        ]);
      },
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  async function markAll() {
    await markAllNotificationsReadRequest();
    markAllRead();
    setItems((current) => current.map((item) => ({ ...item, isRead: true })));
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-muted">
            Mentions, messages, reactions, meetings, and daily work.
          </p>
        </div>
        {items.some((item) => !item.isRead) ? (
          <Button type="button" variant="outline" onClick={() => void markAll()}>
            Mark all read
          </Button>
        ) : null}
      </header>
      {loading ? <PageLoading rows={3} /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {items.length === 0 && !loading ? (
          <EmptyState
            title="No notifications yet"
            description="Mentions, messages, and reminders will show up here."
          />
        ) : null}
        {items.map((item) => (
          <button
            key={item.id}
            className="block w-full px-4 py-3.5 text-left hover:bg-paper"
            onClick={() => {
              if (!item.isRead) {
                void markNotificationReadRequest(item.id);
                markOneRead();
              }
              setItems((current) =>
                current.map((row) =>
                  row.id === item.id ? { ...row, isRead: true } : row,
                ),
              );
              if (
                item.type === NOTIFICATION_TYPE.MEETING_CREATED ||
                item.type === NOTIFICATION_TYPE.MEETING_REMINDER
              ) {
                navigate('/meetings');
                return;
              }
              if (item.referenceId) {
                navigate(`/chat/${item.referenceId}`);
              }
            }}
          >
            <p
              className={`text-sm ${item.isRead ? 'text-muted' : 'font-medium text-ink'}`}
            >
              {item.title}
            </p>
            <p className="mt-0.5 text-sm text-muted">{item.message}</p>
            <p className="mt-1 font-mono text-xs text-muted">
              {new Intl.DateTimeFormat('en-IN', {
                hour: 'numeric',
                minute: '2-digit',
                day: 'numeric',
                month: 'short',
              }).format(new Date(item.createdAt))}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
