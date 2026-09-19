import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { AUDIT_ACTION, ROLES, USER_STATUS } from '@teakflow/shared';
import { AppError } from '../middlewares/errorHandler/index';

vi.mock('../config/database', () => ({
  connectDatabase: vi.fn().mockResolvedValue(true),
  sequelize: null,
}));

vi.mock('../config/cloudinary', () => ({
  connectStorage: vi.fn().mockResolvedValue(true),
}));

vi.mock('../config/redis', () => ({
  connectRedis: vi.fn().mockResolvedValue(false),
  redis: null,
}));

vi.mock('../services/auth/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/auth/index')>();
  return {
    ...actual,
    loginWithPassword: vi.fn(),
    getSessionUser: vi.fn(),
    readSession: vi.fn(),
    issueAuthCookies: vi.fn().mockResolvedValue(undefined),
    clearAuthCookies: vi.fn(),
    revokeRefreshToken: vi.fn(),
    rotateRefreshCookies: vi.fn(),
  };
});

vi.mock('../services/dailyWork/index', () => ({
  getToday: vi.fn(),
  submitToday: vi.fn(),
  updateToday: vi.fn(),
  listHistory: vi.fn(),
  listHistoryForUser: vi.fn(),
  getEntry: vi.fn(),
  getUserEntry: vi.fn(),
  getAdminView: vi.fn(),
}));

vi.mock('../services/chat/index', () => ({
  listConversations: vi.fn(),
  createConversation: vi.fn(),
  createMessage: vi.fn(),
  addReaction: vi.fn(),
  removeReaction: vi.fn(),
  listManagedChannels: vi.fn(),
  deleteChannel: vi.fn(),
  ensureDefaultChannels: vi.fn(),
  listMessages: vi.fn(),
  getConversation: vi.fn(),
  searchMessages: vi.fn(),
  unreadTotal: vi.fn(),
  markRead: vi.fn(),
  updateMessage: vi.fn(),
  deleteMessage: vi.fn(),
  addConversationMember: vi.fn(),
  removeConversationMember: vi.fn(),
}));

vi.mock('../services/meetings/index', () => ({
  listMeetings: vi.fn(),
  createMeeting: vi.fn(),
  getMeeting: vi.fn(),
  joinMeeting: vi.fn(),
}));

vi.mock('../services/audit/index', () => ({
  writeAudit: vi.fn(),
  listAuditLogs: vi.fn(),
}));

const { app } = await import('../app');
const auth = await import('../services/auth/index');
const dailyWork = await import('../services/dailyWork/index');
const chat = await import('../services/chat/index');
const meetings = await import('../services/meetings/index');
const audit = await import('../services/audit/index');

const employee = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Ada',
  email: 'ada@codeteak.com',
  avatar: null,
  designation: 'Backend Developer',
  department: 'Engineering',
  companyId: 'CDTK0001',
  role: ROLES.EMPLOYEE,
  status: USER_STATUS.ACTIVE,
  headedDepartments: [] as string[],
};

function authed() {
  vi.mocked(auth.readSession).mockReturnValue(employee.id);
  vi.mocked(auth.getSessionUser).mockResolvedValue(employee as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('integration · auth', () => {
  it('logs in and returns the session user', async () => {
    vi.mocked(auth.loginWithPassword).mockResolvedValue(employee as never);
    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'ada@codeteak.com',
      password: 'password@1234',
    });
    expect(response.status).toBe(200);
    expect(response.body.data.email).toBe('ada@codeteak.com');
    expect(auth.issueAuthCookies).toHaveBeenCalled();
  });

  it('maps invalid credentials through the error handler', async () => {
    vi.mocked(auth.loginWithPassword).mockRejectedValue(
      new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.'),
    );
    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'ada@codeteak.com',
      password: 'wrong-password',
    });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('integration · daily work', () => {
  it('submits today and returns the entry', async () => {
    authed();
    vi.mocked(dailyWork.submitToday).mockResolvedValue({
      id: 'entry-1',
      workDate: '2026-09-18',
      content: 'Shipped WH-501 hardening.',
      status: 'SUBMITTED',
      submittedAt: '2026-09-18T12:30:00.000Z',
      isLate: false,
    } as never);

    const response = await request(app)
      .post('/api/v1/daily-work')
      .set('Cookie', 'teakflow_access=test')
      .send({ content: 'Shipped WH-501 hardening.' });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('SUBMITTED');
    expect(dailyWork.submitToday).toHaveBeenCalled();
  });

  it('rejects a duplicate submit', async () => {
    authed();
    vi.mocked(dailyWork.submitToday).mockRejectedValue(
      new AppError(409, 'ALREADY_SUBMITTED', "Today's daily work has already been submitted."),
    );
    const response = await request(app)
      .post('/api/v1/daily-work')
      .set('Cookie', 'teakflow_access=test')
      .send({ content: 'Again' });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('ALREADY_SUBMITTED');
  });

  it('rejects edits when the entry is locked', async () => {
    authed();
    vi.mocked(dailyWork.updateToday).mockRejectedValue(
      new AppError(403, 'ENTRY_LOCKED', 'Past daily work entries are locked.'),
    );
    const response = await request(app)
      .patch('/api/v1/daily-work/today')
      .set('Cookie', 'teakflow_access=test')
      .send({ content: 'Too late to change yesterday.' });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ENTRY_LOCKED');
  });
});

describe('integration · chat + reactions', () => {
  it('creates a message in a conversation', async () => {
    authed();
    vi.mocked(chat.createMessage).mockResolvedValue({
      id: 'msg-1',
      conversationId: '22222222-2222-4222-8222-222222222222',
      senderId: employee.id,
      content: 'Hello team',
    } as never);

    const response = await request(app)
      .post('/api/v1/conversations/22222222-2222-4222-8222-222222222222/messages')
      .set('Cookie', 'teakflow_access=test')
      .send({ content: 'Hello team' });

    expect(response.status).toBe(201);
    expect(chat.createMessage).toHaveBeenCalled();
  });

  it('adds a reaction to a message', async () => {
    authed();
    vi.mocked(chat.addReaction).mockResolvedValue({
      id: '33333333-3333-4333-8333-333333333333',
      reactions: [{ reaction: '👍', userIds: [employee.id] }],
    } as never);

    const response = await request(app)
      .post('/api/v1/messages/33333333-3333-4333-8333-333333333333/reactions')
      .set('Cookie', 'teakflow_access=test')
      .send({ reaction: '👍' });

    expect(response.status).toBe(200);
    expect(chat.addReaction).toHaveBeenCalled();
  });
});

describe('integration · meetings', () => {
  it('lists meetings for the signed-in user', async () => {
    authed();
    vi.mocked(meetings.listMeetings).mockResolvedValue([
      {
        id: '44444444-4444-4444-8444-444444444444',
        title: 'Standup',
        googleMeetUrl: 'https://meet.google.com/abc-defg-hij',
      },
    ] as never);

    const response = await request(app).get('/api/v1/meetings').set('Cookie', 'teakflow_access=test');
    expect(response.status).toBe(200);
    expect(response.body.data[0].googleMeetUrl).toContain('meet.google.com');
  });
});

describe('integration · audit logs', () => {
  it('lists audit rows for admins', async () => {
    const admin = { ...employee, role: ROLES.ADMIN };
    vi.mocked(auth.readSession).mockReturnValue(admin.id);
    vi.mocked(auth.getSessionUser).mockResolvedValue(admin as never);
    vi.mocked(audit.listAuditLogs).mockResolvedValue([
      {
        id: '55555555-5555-4555-8555-555555555555',
        userId: admin.id,
        userName: 'Ada',
        action: AUDIT_ACTION.DAILY_WORK_SUBMITTED,
        entityType: 'daily_work_entry',
        entityId: '66666666-6666-4666-8666-666666666666',
        metadata: null,
        createdAt: new Date().toISOString(),
      },
    ]);

    const response = await request(app).get('/api/v1/audit-logs').set('Cookie', 'teakflow_access=test');
    expect(response.status).toBe(200);
    expect(response.body.data[0].action).toBe(AUDIT_ACTION.DAILY_WORK_SUBMITTED);
  });
});
