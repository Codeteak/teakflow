import { NOTIFICATION_TYPE, type AppNotification } from '@teakflow/shared';
import type { NotificationItem, NotificationKind, NotificationPiece } from '@/components/ui/notification-panel';

const ARCHIVE_KEY = 'teakflow.notification.archived';

export function readArchivedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

export function writeArchivedIds(ids: Set<string>) {
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify([...ids]));
}

function kindFor(type: AppNotification['type']): NotificationKind {
  switch (type) {
    case NOTIFICATION_TYPE.MENTION:
      return 'mention';
    case NOTIFICATION_TYPE.REACTION:
      return 'reaction';
    case NOTIFICATION_TYPE.MEETING_CREATED:
    case NOTIFICATION_TYPE.MEETING_REMINDER:
      return 'meeting';
    case NOTIFICATION_TYPE.DAILY_WORK_OPEN:
    case NOTIFICATION_TYPE.DAILY_WORK_REMINDER:
      return 'daily_work';
    default:
      return 'message';
  }
}

function contextFor(type: AppNotification['type']): string[] | undefined {
  switch (type) {
    case NOTIFICATION_TYPE.MENTION:
    case NOTIFICATION_TYPE.MESSAGE:
    case NOTIFICATION_TYPE.REACTION:
      return ['Chat'];
    case NOTIFICATION_TYPE.MEETING_CREATED:
    case NOTIFICATION_TYPE.MEETING_REMINDER:
      return ['Meetings'];
    case NOTIFICATION_TYPE.DAILY_WORK_OPEN:
    case NOTIFICATION_TYPE.DAILY_WORK_REMINDER:
      return ['Daily work'];
    default:
      return undefined;
  }
}

/** Emphasize the place/entity after “in ” / “on ” when the API used that phrasing. */
function bodyPieces(message: string): NotificationPiece[] {
  const match = message.match(/^(.*?\b(?:in|on|to)\s+)(.+)$/i);
  if (!match) {
    return [message];
  }
  return [match[1]!, { entity: match[2]! }];
}

function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return days === 1 ? 'Yesterday' : `${days} days ago`;
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(iso));
}

function toItem(row: AppNotification, archived: boolean): NotificationItem {
  const base = {
    id: row.id,
    kind: kindFor(row.type),
    time: relativeTime(row.createdAt),
    context: contextFor(row.type),
    unread: !row.isRead,
    archived,
    referenceId: row.referenceId,
    sourceType: row.type,
  };

  switch (row.type) {
    case NOTIFICATION_TYPE.MESSAGE:
      return {
        ...base,
        actor: { name: row.title || 'Someone' },
        body: ['sent you a message'],
        quote: row.message,
      };
    case NOTIFICATION_TYPE.MENTION:
    case NOTIFICATION_TYPE.REACTION:
      return {
        ...base,
        actor: { name: row.title || 'Someone' },
        body: bodyPieces(row.message),
      };
    case NOTIFICATION_TYPE.MEETING_CREATED: {
      const match = row.title.match(/^(.+?)\s+created a meeting$/i);
      return {
        ...base,
        actor: { name: match?.[1] ?? 'Someone' },
        body: ['created a meeting'],
        quote: row.message,
      };
    }
    case NOTIFICATION_TYPE.MEETING_REMINDER:
      return {
        ...base,
        actor: { name: 'Teakflow' },
        body: ['reminded you about ', { entity: row.message.replace(/\s+starts in 15 minutes$/i, '') || 'a meeting' }],
      };
    case NOTIFICATION_TYPE.DAILY_WORK_OPEN:
    case NOTIFICATION_TYPE.DAILY_WORK_REMINDER:
      return {
        ...base,
        actor: { name: 'Teakflow' },
        body: [row.message || row.title],
      };
    default:
      return {
        ...base,
        actor: { name: row.title || 'Teakflow' },
        body: [row.message],
      };
  }
}

export function mapAppNotifications(
  rows: AppNotification[],
  archivedIds: Set<string> = readArchivedIds(),
): NotificationItem[] {
  return rows.map((row) => toItem(row, archivedIds.has(row.id)));
}
