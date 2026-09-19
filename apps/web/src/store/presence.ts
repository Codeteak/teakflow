import { create } from 'zustand';
import { PRESENCE_STATUS, type PresenceStatus } from '@teakflow/shared';

type PresenceState = {
  byUserId: Record<string, PresenceStatus>;
  selfStatus: PresenceStatus;
  setSelfStatus: (status: PresenceStatus) => void;
  setUser: (userId: string, status: PresenceStatus) => void;
  hydrateOnline: (userIds: string[]) => void;
  clear: () => void;
};

const SELF_KEY = 'teakflow.presence.self';

function readStoredSelf(): PresenceStatus {
  try {
    const raw = localStorage.getItem(SELF_KEY);
    if (
      raw === PRESENCE_STATUS.AWAY ||
      raw === PRESENCE_STATUS.DND ||
      raw === PRESENCE_STATUS.ONLINE
    ) {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return PRESENCE_STATUS.ONLINE;
}

export function persistSelfPresence(status: PresenceStatus) {
  try {
    if (status === PRESENCE_STATUS.OFFLINE) {
      localStorage.removeItem(SELF_KEY);
      return;
    }
    localStorage.setItem(SELF_KEY, status);
  } catch {
    /* ignore */
  }
}

export const usePresenceStore = create<PresenceState>((set) => ({
  byUserId: {},
  selfStatus: readStoredSelf(),
  setSelfStatus(status) {
    persistSelfPresence(status);
    set({ selfStatus: status });
  },
  setUser(userId, status) {
    set((state) => ({
      byUserId: { ...state.byUserId, [userId]: status },
    }));
  },
  hydrateOnline(userIds) {
    set((state) => {
      const next = { ...state.byUserId };
      for (const id of userIds) {
        if (!next[id] || next[id] === PRESENCE_STATUS.OFFLINE) {
          next[id] = PRESENCE_STATUS.ONLINE;
        }
      }
      return { byUserId: next };
    });
  },
  clear() {
    set({ byUserId: {}, selfStatus: readStoredSelf() });
  },
}));

export function presenceLabel(status: PresenceStatus | undefined) {
  switch (status) {
    case PRESENCE_STATUS.ONLINE:
      return 'Online';
    case PRESENCE_STATUS.AWAY:
      return 'Away';
    case PRESENCE_STATUS.DND:
      return 'Do not disturb';
    default:
      return 'Offline';
  }
}

export function avatarStatusFromPresence(
  status: PresenceStatus | undefined,
): 'online' | 'away' | 'dnd' | 'offline' {
  switch (status) {
    case PRESENCE_STATUS.ONLINE:
      return 'online';
    case PRESENCE_STATUS.AWAY:
      return 'away';
    case PRESENCE_STATUS.DND:
      return 'dnd';
    default:
      return 'offline';
  }
}
