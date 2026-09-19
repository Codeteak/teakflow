import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NOTIFICATION_TYPE } from '@teakflow/shared';
import { CompanySettings } from '../../models/companySettings';
import { DailyWorkEntry } from '../../models/dailyWorkEntry';
import { Notification } from '../../models/notification';
import { User } from '../../models/user';
import { getCompanySettings } from '../settings/index';
import { runDailyWorkReminders } from './reminders';

vi.mock('../../models/companySettings', () => ({
  COMPANY_SETTINGS_ID: 'settings-1',
  CompanySettings: {
    findByPk: vi.fn(),
  },
}));

vi.mock('../../models/dailyWorkEntry', () => ({
  DailyWorkEntry: {
    findAll: vi.fn(),
  },
}));

vi.mock('../../models/notification', () => ({
  Notification: {
    bulkCreate: vi.fn(),
  },
}));

vi.mock('../../models/user', () => ({
  User: {
    findAll: vi.fn(),
  },
}));

vi.mock('../settings/index', () => ({
  getCompanySettings: vi.fn(),
}));

const settings = {
  companyName: 'Codeteak',
  timezone: 'Asia/Kolkata',
  dailyWork: {
    startTime: '18:00',
    endTime: '23:59',
    minCharacters: 50,
    maxCharacters: 1000,
    allowLateSubmission: true,
    reminderEnabled: true,
    reminderTime: '21:00',
  },
  googleConnected: false,
  googleConnectedEmail: null,
};

beforeEach(() => {
  vi.mocked(getCompanySettings).mockResolvedValue(settings);
  vi.mocked(User.findAll).mockResolvedValue([
    { id: 'user-1' },
    { id: 'user-2' },
  ] as never);
  vi.mocked(DailyWorkEntry.findAll).mockResolvedValue([] as never);
  vi.mocked(Notification.bulkCreate).mockClear();
  vi.mocked(Notification.bulkCreate).mockResolvedValue([] as never);
});

describe('runDailyWorkReminders', () => {
  it('does nothing before the window', async () => {
    const row = {
      dailyWorkOpenNotifiedOn: null,
      dailyWorkReminderNotifiedOn: null,
      save: vi.fn(),
    };
    vi.mocked(CompanySettings.findByPk).mockResolvedValue(row as never);
    await runDailyWorkReminders(new Date('2026-09-11T12:29:59.000Z'));
    expect(Notification.bulkCreate).not.toHaveBeenCalled();
  });

  it('notifies everyone once when the window opens', async () => {
    const row = {
      dailyWorkOpenNotifiedOn: null,
      dailyWorkReminderNotifiedOn: null,
      save: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(CompanySettings.findByPk).mockResolvedValue(row as never);
    await runDailyWorkReminders(new Date('2026-09-11T12:30:00.000Z'));
    expect(Notification.bulkCreate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          userId: 'user-1',
          type: NOTIFICATION_TYPE.DAILY_WORK_OPEN,
        }),
      ]),
    );
    expect(row.dailyWorkOpenNotifiedOn).toBe('2026-09-11');
  });

  it('skips the open notification if it already ran today', async () => {
    const row = {
      dailyWorkOpenNotifiedOn: '2026-09-11',
      dailyWorkReminderNotifiedOn: '2026-09-11',
      save: vi.fn(),
    };
    vi.mocked(CompanySettings.findByPk).mockResolvedValue(row as never);
    await runDailyWorkReminders(new Date('2026-09-11T12:35:00.000Z'));
    expect(Notification.bulkCreate).not.toHaveBeenCalled();
  });
});
