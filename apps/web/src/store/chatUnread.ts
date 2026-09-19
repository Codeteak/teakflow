import { create } from 'zustand';

type ChatUnreadState = {
  openId: string | null;
  byId: Record<string, number>;
  setOpenId: (id: string | null) => void;
  hydrate: (items: { id: string; unreadCount: number }[]) => void;
  noteIncoming: (conversationId: string, senderId: string, viewerId: string) => void;
  clear: (conversationId: string) => void;
};

function sumUnread(byId: Record<string, number>, except?: string | null) {
  let total = 0;
  for (const [id, count] of Object.entries(byId)) {
    if (id === except) continue;
    total += count;
  }
  return total;
}

export const useChatUnreadStore = create<ChatUnreadState>((set) => ({
  openId: null,
  byId: {},
  setOpenId: (id) => set({ openId: id }),
  hydrate: (items) =>
    set({
      byId: Object.fromEntries(items.map((item) => [item.id, item.unreadCount])),
    }),
  noteIncoming: (conversationId, senderId, viewerId) =>
    set((state) => {
      if (!conversationId || senderId === viewerId || conversationId === state.openId) {
        return state;
      }
      return {
        byId: {
          ...state.byId,
          [conversationId]: (state.byId[conversationId] ?? 0) + 1,
        },
      };
    }),
  clear: (conversationId) =>
    set((state) => {
      if (!state.byId[conversationId]) {
        return state;
      }
      return { byId: { ...state.byId, [conversationId]: 0 } };
    }),
}));

export function selectOtherUnread(state: ChatUnreadState) {
  return sumUnread(state.byId, state.openId);
}

export function selectTotalUnread(state: ChatUnreadState) {
  return sumUnread(state.byId);
}
