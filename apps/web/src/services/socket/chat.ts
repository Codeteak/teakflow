import { io, type Socket } from 'socket.io-client';
import { SOCKET_EVENTS, NOTIFICATION_TYPE, PRESENCE_STATUS, type PresenceStatus } from '@teakflow/shared';
import type { AppNotification, LinkPreview, Message, StoredFile } from '@teakflow/shared';
import { isViewingConversation, shouldSuppressChatAlert } from '@/features/chat/activeConversation';
import { playNotifySound } from '@/lib/notifySound';
import { useAuthStore } from '@/store/auth';
import { usePresenceStore } from '@/store/presence';

export type ChatHandlers = {
  onMessage?: (message: Message) => void;
  onMessageUpdate?: (message: Message) => void;
  onNotification?: (notification: AppNotification) => void;
  onTyping?: (payload: { conversationId: string; userId: string; typing: boolean }) => void;
  onPresence?: (payload: { userId: string; status: PresenceStatus }) => void;
  onRead?: (payload: { conversationId: string; userId: string; messageId: string }) => void;
  onSessionEnded?: () => void;
};

const listeners = new Set<ChatHandlers>();
const joinedRooms = new Set<string>();
let socket: Socket | null = null;

function notify(run: (handlers: ChatHandlers) => void) {
  for (const handlers of listeners) {
    run(handlers);
  }
}

function applyPresence(userId: string, status: PresenceStatus) {
  usePresenceStore.getState().setUser(userId, status);
  notify((handlers) => handlers.onPresence?.({ userId, status }));
}

function reemitSelfPresence(instance: Socket) {
  const status = usePresenceStore.getState().selfStatus;
  if (status === PRESENCE_STATUS.AWAY || status === PRESENCE_STATUS.DND || status === PRESENCE_STATUS.ONLINE) {
    instance.emit(SOCKET_EVENTS.PRESENCE_SET, { status });
  }
}

function bindSocket(instance: Socket) {
  instance.on('connect', () => {
    for (const conversationId of joinedRooms) {
      instance.emit('conversation:join', conversationId);
    }
    reemitSelfPresence(instance);
  });
  instance.on(SOCKET_EVENTS.MESSAGE_NEW, (message: Message) => {
    const viewerId = useAuthStore.getState().user?.id;
    const viewingThread = isViewingConversation(message.conversationId);
    const selfDnd = usePresenceStore.getState().selfStatus === PRESENCE_STATUS.DND;
    if (viewerId && message.senderId !== viewerId && !viewingThread && !selfDnd) {
      playNotifySound();
    }
    notify((handlers) => handlers.onMessage?.(message));
  });
  instance.on(SOCKET_EVENTS.MESSAGE_UPDATE, (message: Message) =>
    notify((handlers) => handlers.onMessageUpdate?.(message)),
  );
  instance.on(SOCKET_EVENTS.MESSAGE_DELETE, (message: Message) =>
    notify((handlers) => handlers.onMessageUpdate?.(message)),
  );
  instance.on(SOCKET_EVENTS.MESSAGE_REACTION, (message: Message) =>
    notify((handlers) => handlers.onMessageUpdate?.(message)),
  );
  instance.on(SOCKET_EVENTS.NOTIFICATION_NEW, (notification: AppNotification) => {
    if (shouldSuppressChatAlert(notification)) {
      notify((handlers) => handlers.onNotification?.(notification));
      return;
    }
    const selfDnd = usePresenceStore.getState().selfStatus === PRESENCE_STATUS.DND;
    // DM chat already played on message:new — skip duplicate for MESSAGE type.
    if (!selfDnd && notification.type !== NOTIFICATION_TYPE.MESSAGE) {
      playNotifySound();
    }
    notify((handlers) => handlers.onNotification?.(notification));
  });
  instance.on(SOCKET_EVENTS.TYPING_START, (payload: { conversationId: string; userId: string }) =>
    notify((handlers) => handlers.onTyping?.({ ...payload, typing: true })),
  );
  instance.on(SOCKET_EVENTS.TYPING_STOP, (payload: { conversationId: string; userId: string }) =>
    notify((handlers) => handlers.onTyping?.({ ...payload, typing: false })),
  );
  instance.on(SOCKET_EVENTS.USER_PRESENCE, (payload: { userId: string; status: PresenceStatus }) => {
    if (payload?.userId && payload.status) {
      applyPresence(payload.userId, payload.status);
    }
  });
  instance.on(SOCKET_EVENTS.USER_ONLINE, (payload: { userId: string }) => {
    if (!payload?.userId) {
      return;
    }
    const current = usePresenceStore.getState().byUserId[payload.userId];
    if (current === PRESENCE_STATUS.AWAY || current === PRESENCE_STATUS.DND) {
      return;
    }
    applyPresence(payload.userId, PRESENCE_STATUS.ONLINE);
  });
  instance.on(SOCKET_EVENTS.USER_OFFLINE, (payload: { userId: string }) => {
    if (payload?.userId) {
      applyPresence(payload.userId, PRESENCE_STATUS.OFFLINE);
    }
  });
  instance.on(SOCKET_EVENTS.MESSAGE_READ, (payload: { conversationId: string; userId: string; messageId: string }) =>
    notify((handlers) => handlers.onRead?.(payload)),
  );
  instance.on(SOCKET_EVENTS.SESSION_ENDED, () => notify((handlers) => handlers.onSessionEnded?.()));
}

export function connectChatSocket() {
  if (socket) {
    return socket;
  }
  // Prefer a direct API origin in local dev (VITE_SOCKET_URL). Same-origin
  // (Vite /socket.io proxy) is fine for single-host deploys, but the proxy
  // logs noisy EPIPE/ECONNREFUSED every time the API restarts under tsx watch.
  const socketUrl = import.meta.env.VITE_SOCKET_URL?.trim() || undefined;
  socket = io(socketUrl, {
    path: '/socket.io',
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 400,
    timeout: 8000,
  });
  bindSocket(socket);
  return socket;
}

export function subscribeChatSocket(handlers: ChatHandlers) {
  connectChatSocket();
  listeners.add(handlers);
  return () => {
    listeners.delete(handlers);
  };
}

export function joinConversationRoom(conversationId: string) {
  joinedRooms.add(conversationId);
  connectChatSocket();
  if (socket?.connected) {
    socket.emit('conversation:join', conversationId);
  }
}

export function emitTyping(conversationId: string, typing: boolean) {
  socket?.emit(typing ? SOCKET_EVENTS.TYPING_START : SOCKET_EVENTS.TYPING_STOP, { conversationId });
}

export function emitPresence(status: PresenceStatus) {
  connectChatSocket();
  socket?.emit(SOCKET_EVENTS.PRESENCE_SET, { status });
}

export function sendMessageLive(
  conversationId: string,
  content: string,
  replyToMessageId?: string | null,
  attachments?: StoredFile[],
  linkPreviews?: LinkPreview[],
): Promise<Message> {
  connectChatSocket();
  return new Promise((resolve, reject) => {
    const instance = socket;
    if (!instance) {
      reject(new Error('Chat is not connected.'));
      return;
    }
    const finish = (result: { ok: boolean; data?: Message; error?: string }) => {
      if (result?.ok && result.data) {
        resolve(result.data);
        return;
      }
      reject(new Error(result?.error ?? 'Unable to send.'));
    };
    const payload = {
      conversationId,
      content,
      replyToMessageId: replyToMessageId ?? null,
      attachments: attachments ?? [],
      linkPreviews: linkPreviews ?? [],
    };
    if (!instance.connected) {
      instance.once('connect', () => {
        instance.emit(SOCKET_EVENTS.MESSAGE_SEND, payload, finish);
      });
      return;
    }
    instance.emit(SOCKET_EVENTS.MESSAGE_SEND, payload, finish);
  });
}

export function disconnectChatSocket() {
  listeners.clear();
  joinedRooms.clear();
  usePresenceStore.getState().clear();
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}
