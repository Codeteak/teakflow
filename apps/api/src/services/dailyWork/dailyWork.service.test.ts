import { UniqueConstraintError } from 'sequelize';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../middlewares/errorHandler/index';
import { DailyWorkEntry } from '../../models/dailyWorkEntry';
import { SalesDayReport } from '../../models/salesDayReport';
import { User } from '../../models/user';
import { getCompanySettings } from '../settings/index';
import { getEntry, getToday, getUserEntry, getAdminView, listHistoryForUser, submitToday, updateToday } from './index';

vi.mock('../../models/dailyWorkEntry', () => ({
  DailyWorkEntry: {
    findOne: vi.fn(),
    findAll: vi.fn(),
    findByPk: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../../models/salesDayReport', () => ({
  SalesDayReport: {
    findOne: vi.fn(),
  },
}));

vi.mock('../../models/user', () => ({
  User: {
    findAll: vi.fn(),
    findByPk: vi.fn(),
  },
}));

vi.mock('../audit/index', () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
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

const userId = '11111111-1111-4111-8111-111111111111';
const longEnough =
  'I worked on Teakflow daily work submit lock history and admin monitoring for the company workspace today.';

function at(iso: string) {
  return new Date(iso);
}

function publicEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'entry-1',
    userId,
    workDate: '2026-09-11',
    content: longEnough,
    status: 'SUBMITTED',
    submittedAt: '2026-09-11T12:30:00.000Z',
    isLate: false,
    createdAt: '2026-09-11T12:30:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(getCompanySettings).mockResolvedValue(settings);
  vi.mocked(DailyWorkEntry.findOne).mockResolvedValue(null);
  vi.mocked(SalesDayReport.findOne).mockResolvedValue(null);
  vi.mocked(DailyWorkEntry.create).mockImplementation(async (values) => {
    return {
      toPublic: () =>
        publicEntry({
          content: values.content,
          status: values.status,
          isLate: values.isLate,
          submittedAt: values.submittedAt instanceof Date ? values.submittedAt.toISOString() : null,
          workDate: values.workDate,
        }),
    } as never;
  });
});

describe('getToday', () => {
  it('returns LOCKED before the window using the injected server time', async () => {
    const today = await getToday(userId, at('2026-09-11T12:29:59.000Z'));
    expect(today.state).toBe('LOCKED');
    expect(today.workDate).toBe('2026-09-11');
  });

  it('returns OPEN at 18:00:00 company time', async () => {
    const today = await getToday(userId, at('2026-09-11T12:30:00.000Z'));
    expect(today.state).toBe('OPEN');
    expect(today.salesNotebook).toBe('');
  });

  it('includes saved sales visit notes for the notebook', async () => {
    vi.mocked(SalesDayReport.findOne).mockResolvedValue({
      notebookBlocks: 'Families Hypermart · 100022\nVisit',
    } as never);
    const today = await getToday(userId, at('2026-09-11T12:30:00.000Z'));
    expect(today.salesNotebook).toContain('Families Hypermart');
  });

  it('returns SUBMITTED_EDITABLE after submit for the rest of that work date', async () => {
    vi.mocked(DailyWorkEntry.findOne).mockResolvedValue({
      submittedAt: new Date('2026-09-11T12:31:00.000Z'),
      toPublic: () => publicEntry(),
    } as never);

    const duringWindow = await getToday(userId, at('2026-09-11T12:40:00.000Z'));
    expect(duringWindow.state).toBe('SUBMITTED_EDITABLE');

    const afterWindow = await getToday(userId, at('2026-09-11T18:00:00.000Z'));
    expect(afterWindow.state).toBe('SUBMITTED_EDITABLE');
    expect(afterWindow.workDate).toBe('2026-09-11');
    expect(afterWindow.entry?.id).toBe('entry-1');
  });
});

describe('submitToday', () => {
  it('rejects 17:59:59', async () => {
    await expect(submitToday(userId, { content: longEnough }, at('2026-09-11T12:29:59.000Z'))).rejects.toMatchObject({
      statusCode: 403,
      code: 'WINDOW_CLOSED',
    });
    expect(DailyWorkEntry.create).not.toHaveBeenCalled();
  });

  it('accepts exactly 18:00:00 and stores server submittedAt', async () => {
    const now = at('2026-09-11T12:30:00.000Z');
    const entry = await submitToday(userId, { content: longEnough }, now);
    expect(entry.status).toBe('SUBMITTED');
    expect(entry.isLate).toBe(false);
    expect(entry.submittedAt).toBe(now.toISOString());
    expect(DailyWorkEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        workDate: '2026-09-11',
        submittedAt: now,
      }),
    );
  });

  it('ignores a later browser clock by using only the server now argument', async () => {
    await expect(submitToday(userId, { content: longEnough }, at('2026-09-11T12:29:59.000Z'))).rejects.toBeInstanceOf(
      AppError,
    );
  });

  it('revalidates when the form was opened before the window and submitted after it opens', async () => {
    const whileWaiting = await getToday(userId, at('2026-09-11T12:29:59.000Z'));
    expect(whileWaiting.state).toBe('LOCKED');

    const entry = await submitToday(userId, { content: longEnough }, at('2026-09-11T12:30:00.000Z'));
    expect(entry.status).toBe('SUBMITTED');
  });

  it('rejects a second submit when today is already submitted', async () => {
    vi.mocked(DailyWorkEntry.findOne).mockResolvedValue({
      submittedAt: new Date('2026-09-11T12:31:00.000Z'),
      toPublic: () => publicEntry(),
    } as never);

    await expect(submitToday(userId, { content: longEnough }, at('2026-09-11T12:32:00.000Z'))).rejects.toMatchObject({
      code: 'ALREADY_SUBMITTED',
      statusCode: 409,
    });
  });

  it('maps a unique constraint to already submitted', async () => {
    vi.mocked(DailyWorkEntry.create).mockRejectedValue(new UniqueConstraintError({}));
    await expect(submitToday(userId, { content: longEnough }, at('2026-09-11T12:30:00.000Z'))).rejects.toMatchObject({
      code: 'ALREADY_SUBMITTED',
    });
  });

  it('rejects whitespace-only content', async () => {
    await expect(submitToday(userId, { content: '   \n  ' }, at('2026-09-11T12:30:00.000Z'))).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('rejects content below the configured minimum', async () => {
    await expect(submitToday(userId, { content: 'too short' }, at('2026-09-11T12:30:00.000Z'))).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('allows content above the old 1000-character cap', async () => {
    await expect(
      submitToday(userId, { content: `${longEnough} ${'x'.repeat(200)}` }, at('2026-09-11T12:30:00.000Z')),
    ).resolves.toMatchObject({ status: 'SUBMITTED' });
  });

  it('marks LATE when submitting after the window if late is allowed', async () => {
    vi.mocked(getCompanySettings).mockResolvedValue({
      ...settings,
      dailyWork: { ...settings.dailyWork, startTime: '18:00', endTime: '21:00', allowLateSubmission: true },
    });
    const entry = await submitToday(userId, { content: longEnough }, at('2026-09-11T16:00:00.000Z'));
    expect(entry.status).toBe('LATE');
    expect(entry.isLate).toBe(true);
  });

  it('rejects after the window when late is disabled', async () => {
    vi.mocked(getCompanySettings).mockResolvedValue({
      ...settings,
      dailyWork: { ...settings.dailyWork, startTime: '18:00', endTime: '21:00', allowLateSubmission: false },
    });
    await expect(submitToday(userId, { content: longEnough }, at('2026-09-11T16:00:00.000Z'))).rejects.toMatchObject({
      code: 'WINDOW_CLOSED',
    });
  });
});

describe('updateToday', () => {
  it('allows editing submitted content after the evening window on the same work date', async () => {
    const entry = {
      id: 'entry-1',
      userId,
      workDate: '2026-09-11',
      submittedAt: new Date('2026-09-11T12:31:00.000Z'),
      content: longEnough,
      allowWindowEdit: false,
      save: vi.fn(async function save(this: { content: string }) {
        return this;
      }),
      toPublic: () => publicEntry({ content: `${longEnough} Updated notes.` }),
    };
    vi.mocked(DailyWorkEntry.findOne).mockResolvedValue({
      submittedAt: entry.submittedAt,
      toPublic: () => publicEntry(),
    } as never);
    vi.mocked(DailyWorkEntry.findByPk).mockResolvedValue(entry as never);

    const updated = await updateToday(
      userId,
      { content: `${longEnough} Updated notes.` },
      // 23:30 IST on 2026-09-11 — after a typical evening window, still same work date
      at('2026-09-11T18:00:00.000Z'),
    );
    expect(entry.allowWindowEdit).toBe(true);
    expect(entry.content).toBe(`${longEnough} Updated notes.`);
    expect(entry.save).toHaveBeenCalled();
    expect(updated.content).toContain('Updated notes');
  });

  it('rejects edits when there is no submitted entry for today', async () => {
    vi.mocked(DailyWorkEntry.findOne).mockResolvedValue(null);

    await expect(
      updateToday(userId, { content: `${longEnough} too early` }, at('2026-09-11T12:45:00.000Z')),
    ).rejects.toMatchObject({
      code: 'ENTRY_LOCKED',
      statusCode: 403,
    });
  });
});

describe('history access', () => {
  const otherId = '22222222-2222-4222-8222-222222222222';

  it('lets an employee read their own entry', async () => {
    vi.mocked(DailyWorkEntry.findByPk).mockResolvedValue({
      userId,
      toPublic: () => publicEntry(),
    } as never);
    const entry = await getEntry(userId, 'entry-1', 'EMPLOYEE');
    expect(entry.id).toBe('entry-1');
  });

  it('blocks an employee from reading someone else entry', async () => {
    vi.mocked(DailyWorkEntry.findByPk).mockResolvedValue({
      userId: otherId,
      toPublic: () => publicEntry({ userId: otherId }),
    } as never);
    await expect(getEntry(userId, 'entry-1', 'EMPLOYEE')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('lets a manager read an assigned employee entry', async () => {
    vi.mocked(DailyWorkEntry.findByPk).mockResolvedValue({
      userId: otherId,
      toPublic: () => publicEntry({ userId: otherId }),
    } as never);
    vi.mocked(User.findAll).mockResolvedValue([
      { id: userId, managerId: null },
      { id: otherId, managerId: userId },
    ] as never);
    const entry = await getEntry(userId, 'entry-1', 'MANAGER');
    expect(entry.userId).toBe(otherId);
  });

  it('blocks a manager from reading someone outside their team', async () => {
    vi.mocked(DailyWorkEntry.findByPk).mockResolvedValue({
      userId: otherId,
      toPublic: () => publicEntry({ userId: otherId }),
    } as never);
    vi.mocked(User.findAll).mockResolvedValue([
      { id: userId, managerId: null },
      { id: otherId, managerId: '33333333-3333-4333-8333-333333333333' },
    ] as never);
    await expect(getEntry(userId, 'entry-1', 'MANAGER')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('forbids employees from the admin user lookup', async () => {
    await expect(getUserEntry(userId, 'EMPLOYEE', otherId)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('lets a manager list previous daily work for someone in their tree', async () => {
    vi.mocked(User.findByPk).mockResolvedValue({ id: otherId, managerId: userId } as never);
    vi.mocked(User.findAll).mockResolvedValue([
      { id: userId, managerId: null },
      { id: otherId, managerId: userId },
    ] as never);
    vi.mocked(DailyWorkEntry.findAll).mockResolvedValue([
      { toPublic: () => publicEntry({ userId: otherId, workDate: '2026-09-10' }) },
    ] as never);
    const rows = await listHistoryForUser(userId, 'MANAGER', otherId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.workDate).toBe('2026-09-10');
  });

  it('blocks a manager from listing history outside their tree', async () => {
    vi.mocked(User.findByPk).mockResolvedValue({
      id: otherId,
      managerId: '33333333-3333-4333-8333-333333333333',
    } as never);
    vi.mocked(User.findAll).mockResolvedValue([
      { id: userId, managerId: null },
      { id: otherId, managerId: '33333333-3333-4333-8333-333333333333' },
    ] as never);
    await expect(listHistoryForUser(userId, 'MANAGER', otherId)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('getAdminView scope', () => {
  const otherId = '22222222-2222-4222-8222-222222222222';
  const leadId = '44444444-4444-4444-8444-444444444444';
  const outsiderId = '33333333-3333-4333-8333-333333333333';

  const company = [
    {
      id: userId,
      name: 'Nisha',
      managerId: null,
      avatar: null,
      designation: 'PM',
      department: 'Engineering',
    },
    {
      id: leadId,
      name: 'Asha',
      managerId: userId,
      avatar: null,
      designation: 'Lead',
      department: 'Engineering',
    },
    {
      id: otherId,
      name: 'Rahul',
      managerId: leadId,
      avatar: null,
      designation: 'Dev',
      department: 'Engineering',
    },
    {
      id: outsiderId,
      name: 'Outsider',
      managerId: null,
      avatar: null,
      designation: 'Sales',
      department: 'Sales',
    },
  ];

  it('shows a manager only their reporting tree', async () => {
    vi.mocked(User.findAll).mockResolvedValue(company as never);
    vi.mocked(DailyWorkEntry.findAll).mockResolvedValue([]);
    const view = await getAdminView(userId, 'MANAGER', at('2026-09-18T06:30:00.000Z'));
    expect(view.rows.map((row) => row.userId).sort()).toEqual([leadId, otherId, userId].sort());
  });

  it('shows a lead only themselves and people who report through them', async () => {
    vi.mocked(User.findAll).mockResolvedValue(company as never);
    vi.mocked(DailyWorkEntry.findAll).mockResolvedValue([]);
    const view = await getAdminView(leadId, 'LEAD', at('2026-09-18T06:30:00.000Z'));
    expect(view.rows.map((row) => row.userId).sort()).toEqual([leadId, otherId].sort());
  });

  it('forbids employees from the team view', async () => {
    await expect(getAdminView(otherId, 'EMPLOYEE', at('2026-09-18T06:30:00.000Z'))).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
