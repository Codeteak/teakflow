import { create } from 'zustand';
import type { SessionUser } from '@teakflow/shared';
import { disconnectChatSocket } from '@/services/socket/chat';

const LOGGED_OUT_KEY = 'teakflow.loggedOut';
const RESTRICTED_KEY = 'teakflow.restricted';

type AuthState = {
  user: SessionUser | null;
  setUser: (user: SessionUser | null) => void;
  clearSession: () => void;
};

export function markLoggedOut() {
  try {
    sessionStorage.setItem(LOGGED_OUT_KEY, '1');
  } catch {
    // Ignore private-mode storage failures.
  }
}

export function markRestricted(message: string) {
  try {
    sessionStorage.setItem(RESTRICTED_KEY, message);
  } catch {
    // Ignore private-mode storage failures.
  }
}

export function consumeRestrictedMessage() {
  try {
    const message = sessionStorage.getItem(RESTRICTED_KEY);
    if (message) {
      sessionStorage.removeItem(RESTRICTED_KEY);
    }
    return message;
  } catch {
    return null;
  }
}

export function consumeLoggedOutFlag() {
  try {
    const marked = sessionStorage.getItem(LOGGED_OUT_KEY) === '1';
    if (marked) {
      sessionStorage.removeItem(LOGGED_OUT_KEY);
    }
    return marked;
  } catch {
    return false;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clearSession: () => {
    markLoggedOut();
    disconnectChatSocket();
    set({ user: null });
  },
}));
