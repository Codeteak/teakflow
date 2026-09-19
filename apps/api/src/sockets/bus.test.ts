import { describe, expect, it } from 'vitest';
import { PRESENCE_STATUS } from '@teakflow/shared';
import {
  getUserPresence,
  isUserDnd,
  markUserOffline,
  markUserOnline,
  setUserPresence,
} from './bus';

describe('presence bus', () => {
  it('tracks online, away, dnd, and offline', () => {
    const userId = 'presence-user-1';
    markUserOnline(userId);
    expect(getUserPresence(userId)).toBe(PRESENCE_STATUS.ONLINE);
    expect(isUserDnd(userId)).toBe(false);

    setUserPresence(userId, PRESENCE_STATUS.AWAY);
    expect(getUserPresence(userId)).toBe(PRESENCE_STATUS.AWAY);

    setUserPresence(userId, PRESENCE_STATUS.DND);
    expect(getUserPresence(userId)).toBe(PRESENCE_STATUS.DND);
    expect(isUserDnd(userId)).toBe(true);

    markUserOffline(userId);
    expect(getUserPresence(userId)).toBe(PRESENCE_STATUS.OFFLINE);
    expect(isUserDnd(userId)).toBe(false);
  });
});
