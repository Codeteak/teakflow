import type { Server } from 'socket.io';
import { PRESENCE_STATUS, SOCKET_EVENTS, type PresenceStatus } from '@teakflow/shared';

let io: Server | null = null;
const onlineCounts = new Map<string, number>();
const presenceByUser = new Map<string, PresenceStatus>();

export function setIo(server: Server) {
  io = server;
}

export function getIo() {
  return io;
}

export function disconnectUserSockets(userId: string) {
  io?.to(`user:${userId}`).emit(SOCKET_EVENTS.SESSION_ENDED, { reason: 'ACCOUNT_RESTRICTED' });
  io?.in(`user:${userId}`).disconnectSockets(true);
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}

export function emitToConversation(conversationId: string, event: string, payload: unknown) {
  if (!io) {
    return;
  }
  io.to(`conversation:${conversationId}`).emit(event, payload);
}

export function broadcastMessage(memberIds: string[], payload: unknown, exceptUserId?: string) {
  if (!io) {
    return;
  }
  const rooms = [...new Set(memberIds)]
    .filter((id) => id !== exceptUserId)
    .map((id) => `user:${id}`);
  if (rooms.length === 0) {
    return;
  }
  io.to(rooms).emit(SOCKET_EVENTS.MESSAGE_NEW, payload);
}

function emitPresence(userId: string, status: PresenceStatus) {
  presenceByUser.set(userId, status);
  io?.emit(SOCKET_EVENTS.USER_PRESENCE, { userId, status });
  if (status === PRESENCE_STATUS.OFFLINE) {
    io?.emit(SOCKET_EVENTS.USER_OFFLINE, { userId });
  } else if (status === PRESENCE_STATUS.ONLINE) {
    io?.emit(SOCKET_EVENTS.USER_ONLINE, { userId });
  }
}

export function markUserOnline(userId: string) {
  const next = (onlineCounts.get(userId) ?? 0) + 1;
  onlineCounts.set(userId, next);
  if (next === 1) {
    const current = presenceByUser.get(userId);
    if (current === PRESENCE_STATUS.AWAY || current === PRESENCE_STATUS.DND) {
      emitPresence(userId, current);
      return;
    }
    emitPresence(userId, PRESENCE_STATUS.ONLINE);
  }
}

export function markUserOffline(userId: string) {
  const current = onlineCounts.get(userId) ?? 0;
  if (current <= 1) {
    onlineCounts.delete(userId);
    presenceByUser.delete(userId);
    io?.emit(SOCKET_EVENTS.USER_PRESENCE, { userId, status: PRESENCE_STATUS.OFFLINE });
    io?.emit(SOCKET_EVENTS.USER_OFFLINE, { userId });
    return;
  }
  onlineCounts.set(userId, current - 1);
}

export function setUserPresence(userId: string, status: PresenceStatus) {
  if (status === PRESENCE_STATUS.OFFLINE) {
    return;
  }
  if ((onlineCounts.get(userId) ?? 0) <= 0) {
    return;
  }
  emitPresence(userId, status);
}

export function getUserPresence(userId: string): PresenceStatus {
  if ((onlineCounts.get(userId) ?? 0) <= 0) {
    return PRESENCE_STATUS.OFFLINE;
  }
  return presenceByUser.get(userId) ?? PRESENCE_STATUS.ONLINE;
}

export function isUserOnline(userId: string) {
  return (onlineCounts.get(userId) ?? 0) > 0;
}

export function isUserDnd(userId: string) {
  return getUserPresence(userId) === PRESENCE_STATUS.DND;
}

export function onlineUserIds() {
  return [...onlineCounts.keys()];
}
