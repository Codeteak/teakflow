import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT_RESTRICTED_MESSAGE, USER_STATUS } from '@teakflow/shared';
import { User } from '../../models/user';
import { loginWithPassword, readSession, signAccessToken } from './index';

vi.mock('../../models/user', () => ({
  User: {
    findOne: vi.fn(),
    findByPk: vi.fn(),
  },
}));

const password = 'password@1234';

async function fakeUser(status: string) {
  const passwordHash = await bcrypt.hash(password, 4);
  return {
    id: 'user-1',
    email: 'ada@codeteak.com',
    passwordHash,
    status,
    lastSeenAt: null,
    save: vi.fn().mockResolvedValue(undefined),
    toSession: () => ({
      id: 'user-1',
      name: 'Ada',
      email: 'ada@codeteak.com',
      avatar: null,
      designation: 'Backend Developer',
      department: 'Engineering',
      role: 'EMPLOYEE',
      status,
    }),
  };
}

beforeEach(() => {
  vi.mocked(User.findOne).mockReset();
});

describe('loginWithPassword', () => {
  it('rejects a short password before hitting the database', async () => {
    await expect(
      loginWithPassword({ email: 'ada@codeteak.com', password: 'short' }),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
    expect(User.findOne).not.toHaveBeenCalled();
  });

  it('rejects an unknown email', async () => {
    vi.mocked(User.findOne).mockResolvedValue(null);
    await expect(
      loginWithPassword({ email: 'missing@codeteak.com', password }),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('rejects a wrong password', async () => {
    vi.mocked(User.findOne).mockResolvedValue(
      (await fakeUser(USER_STATUS.ACTIVE)) as never,
    );
    await expect(
      loginWithPassword({ email: 'ada@codeteak.com', password: 'wrong-password' }),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('blocks a disabled employee', async () => {
    vi.mocked(User.findOne).mockResolvedValue(
      (await fakeUser(USER_STATUS.INACTIVE)) as never,
    );
    await expect(
      loginWithPassword({ email: 'ada@codeteak.com', password }),
    ).rejects.toMatchObject({
      code: 'ACCOUNT_RESTRICTED',
      statusCode: 403,
      message: ACCOUNT_RESTRICTED_MESSAGE,
    });
  });

  it('returns a session for an active employee', async () => {
    const user = await fakeUser(USER_STATUS.ACTIVE);
    vi.mocked(User.findOne).mockResolvedValue(user as never);
    const session = await loginWithPassword({ email: 'Ada@codeteak.com', password });
    expect(session.email).toBe('ada@codeteak.com');
    expect(user.save).toHaveBeenCalled();
  });
});

describe('access token', () => {
  it('embeds the user id for three-hour sessions', () => {
    const token = signAccessToken('user-1');
    expect(readSession(token)).toBe('user-1');
  });
});
