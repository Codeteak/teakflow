import { create } from 'zustand';

type NotificationUnreadState = {
  unread: number;
  hydrate: (count: number) => void;
  noteNew: () => void;
  markOneRead: () => void;
  markAllRead: () => void;
};

export const useNotificationUnreadStore = create<NotificationUnreadState>((set) => ({
  unread: 0,
  hydrate: (count) => set({ unread: Math.max(0, count) }),
  noteNew: () => set((state) => ({ unread: state.unread + 1 })),
  markOneRead: () => set((state) => ({ unread: Math.max(0, state.unread - 1) })),
  markAllRead: () => set({ unread: 0 }),
}));
