import type { createServer } from 'node:http';
import { Server } from 'socket.io';
import { SOCKET_EVENTS, PRESENCE_STATUS, type PresenceStatus } from '@teakflow/shared';
import { env } from '../config/env';
import { ConversationMember } from '../models/conversationMember';
import { ACCESS_COOKIE, getSessionUser, readSession } from '../services/auth/index';
import type { LinkPreview, StoredFile } from '@teakflow/shared';
import { createMessage } from '../services/chat/index';
import { AppError } from '../middlewares/errorHandler/index';
import { markUserOffline, markUserOnline, setIo, setUserPresence } from './bus';

function cookieValue(header: string | undefined, name: string) {
  if (!header) {
    return undefined;
  }
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return undefined;
}

async function joinMemberRooms(
  socket: { join: (room: string) => Promise<void> | void },
  userId: string,
) {
  const memberships = await ConversationMember.findAll({
    where: { userId },
    attributes: ['conversationId'],
  });
  await Promise.all(
    memberships.map((row) => socket.join(`conversation:${row.conversationId}`)),
  );
}

export function attachSockets(httpServer: ReturnType<typeof createServer>) {
  const io = new Server(httpServer, {
    cors: {
      origin: [env.CLIENT_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
    },
    pingInterval: 20000,
    pingTimeout: 20000,
  });
  setIo(io);

  io.use(async (socket, next) => {
    try {
      const token =
        cookieValue(socket.handshake.headers.cookie, ACCESS_COOKIE) ??
        cookieValue(socket.handshake.headers.cookie, 'teakflow_session');
      if (!token) {
        next(new Error('Authentication is required.'));
        return;
      }
      const userId = readSession(token);
      const user = await getSessionUser(userId);
      socket.data.userId = user.id;
      socket.data.userName = user.name;
      socket.data.role = user.role;
      next();
    } catch {
      next(new Error('Authentication is required.'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    void socket.join(`user:${userId}`);
    markUserOnline(userId);
    void joinMemberRooms(socket, userId).catch(() => undefined);

    socket.on(
      'conversation:join',
      async (conversationId: string, ack?: (ok: boolean) => void) => {
        if (typeof conversationId !== 'string') {
          ack?.(false);
          return;
        }
        const member = await ConversationMember.findOne({
          where: { conversationId, userId },
          attributes: ['id'],
        });
        if (!member) {
          ack?.(false);
          return;
        }
        await socket.join(`conversation:${conversationId}`);
        ack?.(true);
      },
    );

    socket.on(
      SOCKET_EVENTS.MESSAGE_SEND,
      async (
        payload: {
          conversationId?: string;
          content?: string;
          replyToMessageId?: string | null;
          attachments?: unknown;
          linkPreviews?: unknown;
        },
        ack?: (result: { ok: boolean; data?: unknown; error?: string }) => void,
      ) => {
        try {
          const conversationId = payload?.conversationId;
          const content = payload?.content ?? '';
          const attachments = Array.isArray(payload?.attachments)
            ? payload.attachments
            : [];
          if (!conversationId || (!content.trim() && attachments.length === 0)) {
            ack?.({ ok: false, error: 'Write a message or attach a file.' });
            return;
          }
          const message = await createMessage(
            userId,
            conversationId,
            content,
            payload.replyToMessageId,
            {
              senderName: socket.data.userName as string | undefined,
              attachments: attachments as StoredFile[],
              linkPreviews: Array.isArray(payload.linkPreviews)
                ? (payload.linkPreviews as LinkPreview[])
                : [],
            },
          );
          ack?.({ ok: true, data: message });
        } catch (error) {
          const message = error instanceof AppError ? error.message : 'Unable to send.';
          ack?.({ ok: false, error: message });
        }
      },
    );

    socket.on(SOCKET_EVENTS.TYPING_START, (payload: { conversationId?: string }) => {
      const conversationId = payload?.conversationId;
      if (!conversationId) {
        return;
      }
      socket.to(`conversation:${conversationId}`).emit(SOCKET_EVENTS.TYPING_START, {
        conversationId,
        userId,
      });
    });

    socket.on(SOCKET_EVENTS.TYPING_STOP, (payload: { conversationId?: string }) => {
      const conversationId = payload?.conversationId;
      if (!conversationId) {
        return;
      }
      socket.to(`conversation:${conversationId}`).emit(SOCKET_EVENTS.TYPING_STOP, {
        conversationId,
        userId,
      });
    });

    socket.on(SOCKET_EVENTS.PRESENCE_SET, (payload: { status?: string }) => {
      const status = payload?.status;
      if (
        status !== PRESENCE_STATUS.ONLINE &&
        status !== PRESENCE_STATUS.AWAY &&
        status !== PRESENCE_STATUS.DND
      ) {
        return;
      }
      setUserPresence(userId, status as PresenceStatus);
    });

    socket.on('disconnect', () => {
      markUserOffline(userId);
    });
  });

  return io;
}
