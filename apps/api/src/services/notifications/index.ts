import type { AppNotification, NotificationType } from '@teakflow/shared';
import { Notification } from '../../models/notification';
import { emitToUser, isUserDnd } from '../../sockets/bus';
import { SOCKET_EVENTS } from '@teakflow/shared';

export function toPublicNotification(row: Notification): AppNotification {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    title: row.title,
    message: row.message,
    referenceId: row.referenceId,
    isRead: row.isRead,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createNotification(input: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  referenceId?: string | null;
}) {
  const row = await Notification.create({
    userId: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    referenceId: input.referenceId ?? null,
    isRead: false,
  });
  const payload = toPublicNotification(row);
  // DND: still persist for later; skip realtime push/sound.
  if (!isUserDnd(input.userId)) {
    emitToUser(input.userId, SOCKET_EVENTS.NOTIFICATION_NEW, payload);
  }
  return payload;
}

export async function listNotifications(userId: string) {
  const rows = await Notification.findAll({
    where: { userId },
    order: [['createdAt', 'DESC']],
    limit: 80,
  });
  return rows.map(toPublicNotification);
}

export async function markNotificationRead(userId: string, id: string) {
  const row = await Notification.findOne({ where: { id, userId } });
  if (!row) {
    return null;
  }
  row.isRead = true;
  await row.save();
  return toPublicNotification(row);
}

export async function markAllNotificationsRead(userId: string) {
  await Notification.update({ isRead: true }, { where: { userId, isRead: false } });
}
