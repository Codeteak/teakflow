import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Op } from 'sequelize';
import { MEETING_PARTICIPANT_STATUS, NOTIFICATION_TYPE, ROLES, USER_STATUS } from '@teakflow/shared';
import { ConversationMember } from '../../models/conversationMember';
import { Meeting } from '../../models/meeting';
import { MeetingParticipant } from '../../models/meetingParticipant';
import { User } from '../../models/user';
import { writeAudit } from '../audit/index';
import { createMessage } from '../chat/index';
import { createMeetEvent } from '../google/index';
import { createNotification } from '../notifications/index';
import { createMeeting, joinMeeting } from './index';

vi.mock('../../models/conversationMember', () => ({
  ConversationMember: { findOne: vi.fn() },
}));
vi.mock('../../models/meeting', () => ({
  Meeting: {
    sequelize: {},
    create: vi.fn(),
    findByPk: vi.fn(),
    findAll: vi.fn(),
  },
}));
vi.mock('../../models/meetingParticipant', () => ({
  MeetingParticipant: {
    bulkCreate: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
  },
}));
vi.mock('../../models/user', () => ({
  User: { findAll: vi.fn(), findByPk: vi.fn() },
}));
vi.mock('../audit/index', () => ({ writeAudit: vi.fn() }));
vi.mock('../chat/index', () => ({ createMessage: vi.fn() }));
vi.mock('../google/index', () => ({ createMeetEvent: vi.fn() }));
vi.mock('../notifications/index', () => ({ createNotification: vi.fn() }));

const creator = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Admin',
  email: 'admin@codeteak.com',
  role: ROLES.ADMIN,
  status: USER_STATUS.ACTIVE,
};
const invitee = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Rahul',
  email: 'rahul@codeteak.com',
  role: ROLES.EMPLOYEE,
  status: USER_STATUS.ACTIVE,
};
const inactive = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Gone',
  email: 'gone@codeteak.com',
  role: ROLES.EMPLOYEE,
  status: USER_STATUS.INACTIVE,
};

const start = '2026-09-18T10:30:00.000Z';
const end = '2026-09-18T11:30:00.000Z';

function meetingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    title: 'Frontend Discussion',
    createdBy: creator.id,
    googleMeetUrl: 'https://meet.google.com/abc-defg-hij',
    googleEventId: 'evt-1',
    startTime: new Date(start),
    endTime: new Date(end),
    conversationId: null,
    reminderSentAt: null,
    createdAt: new Date(start),
    updatedAt: new Date(start),
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(createMeetEvent).mockResolvedValue({
    eventId: 'evt-1',
    meetUrl: 'https://meet.google.com/abc-defg-hij',
  });
  vi.mocked(Meeting.create).mockReset();
  vi.mocked(Meeting.create).mockResolvedValue(meetingRow() as never);
  vi.mocked(Meeting.findByPk).mockResolvedValue(meetingRow() as never);
  vi.mocked(MeetingParticipant.bulkCreate).mockResolvedValue([] as never);
  vi.mocked(MeetingParticipant.findAll).mockResolvedValue([] as never);
  vi.mocked(User.findByPk).mockResolvedValue({ name: creator.name } as never);
  vi.mocked(createNotification).mockResolvedValue({} as never);
  vi.mocked(createMessage).mockResolvedValue({} as never);
  vi.mocked(writeAudit).mockResolvedValue(undefined as never);
});

describe('createMeeting', () => {
  it('stores the Google event id and Meet URL and notifies invitees', async () => {
    vi.mocked(User.findAll).mockResolvedValue([creator, invitee] as never);
    await createMeeting(creator as never, {
      title: 'Frontend Discussion',
      participantUserIds: [invitee.id, invitee.id],
      startTime: start,
      endTime: end,
    });
    expect(createMeetEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Frontend Discussion',
        attendeeEmails: expect.arrayContaining([creator.email, invitee.email]),
      }),
    );
    expect(Meeting.create).toHaveBeenCalledWith(
      expect.objectContaining({
        googleMeetUrl: 'https://meet.google.com/abc-defg-hij',
        googleEventId: 'evt-1',
      }),
    );
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: invitee.id,
        type: NOTIFICATION_TYPE.MEETING_CREATED,
      }),
    );
    expect(createMessage).not.toHaveBeenCalled();
  });

  it('lets a manager invite a nested employee under a lead', async () => {
    const manager = { ...creator, id: creator.id, role: ROLES.MANAGER, name: 'Nisha', managerId: null };
    const lead = {
      id: '55555555-5555-4555-8555-555555555555',
      name: 'Lead',
      email: 'lead@codeteak.com',
      role: ROLES.LEAD,
      status: USER_STATUS.ACTIVE,
      managerId: manager.id,
    };
    const nested = { ...invitee, managerId: lead.id };
    const all = [manager, lead, nested];
    vi.mocked(User.findAll).mockImplementation((options) => {
      const ids = (options as { where?: { id?: { [key: symbol]: string[] } } } | undefined)?.where?.id?.[Op.in];
      const rows = ids ? all.filter((person) => ids.includes(person.id)) : all;
      return Promise.resolve(rows) as never;
    });
    await createMeeting(manager as never, {
      title: 'Frontend Discussion',
      participantUserIds: [nested.id],
      startTime: start,
      endTime: end,
    });
    expect(Meeting.create).toHaveBeenCalled();
  });

  it('lets a lead invite their employee', async () => {
    const lead = { ...creator, id: creator.id, role: ROLES.LEAD, name: 'Asha', managerId: null };
    const report = { ...invitee, managerId: lead.id };
    vi.mocked(User.findAll).mockResolvedValue([lead, report] as never);
    await createMeeting(lead as never, {
      title: 'Frontend Discussion',
      participantUserIds: [report.id],
      startTime: start,
      endTime: end,
    });
    expect(Meeting.create).toHaveBeenCalled();
  });

  it('blocks a manager from inviting someone not assigned to them', async () => {
    const manager = { ...creator, role: ROLES.MANAGER, name: 'Nisha', managerId: null };
    const outsider = { ...invitee, managerId: null };
    vi.mocked(User.findAll).mockResolvedValue([manager, outsider] as never);
    await expect(
      createMeeting(manager as never, {
        title: 'Frontend Discussion',
        participantUserIds: [outsider.id],
        startTime: start,
        endTime: end,
      }),
    ).rejects.toMatchObject({ code: 'PARTICIPANT_OUT_OF_SCOPE' });
    expect(Meeting.create).not.toHaveBeenCalled();
  });

  it('rejects inactive participants', async () => {
    vi.mocked(User.findAll).mockResolvedValue([creator, inactive] as never);
    await expect(
      createMeeting(creator as never, {
        title: 'Frontend Discussion',
        participantIds: [inactive.id],
        startTime: start,
        endTime: end,
      }),
    ).rejects.toMatchObject({ code: 'PARTICIPANT_INACTIVE' });
    expect(Meeting.create).not.toHaveBeenCalled();
  });

  it('posts a chat card only when the creator is a conversation member', async () => {
    const conversationId = '55555555-5555-4555-8555-555555555555';
    vi.mocked(User.findAll).mockResolvedValue([creator, invitee] as never);
    vi.mocked(ConversationMember.findOne).mockResolvedValue({ id: 'm1' } as never);
    vi.mocked(Meeting.create).mockResolvedValue(meetingRow({ conversationId }) as never);
    await createMeeting(creator as never, {
      title: 'Frontend Discussion',
      participantUserIds: [invitee.id],
      startTime: start,
      endTime: end,
      conversationId,
    });
    expect(createMessage).toHaveBeenCalledWith(
      creator.id,
      conversationId,
      expect.any(String),
      null,
      expect.objectContaining({
        meeting: expect.objectContaining({ kind: 'meeting', meetingId: meetingRow().id }),
      }),
    );
  });

  it('rejects a conversation card when the caller is not a member', async () => {
    vi.mocked(ConversationMember.findOne).mockResolvedValue(null);
    await expect(
      createMeeting(creator as never, {
        title: 'Frontend Discussion',
        participantUserIds: [invitee.id],
        startTime: start,
        endTime: end,
        conversationId: '55555555-5555-4555-8555-555555555555',
      }),
    ).rejects.toMatchObject({ code: 'NOT_A_MEMBER' });
  });
});

describe('joinMeeting', () => {
  it('forbids people who were not invited', async () => {
    vi.mocked(MeetingParticipant.findOne).mockResolvedValue(null);
    const stranger = { ...invitee, id: '66666666-6666-4666-8666-666666666666', role: ROLES.EMPLOYEE };
    await expect(joinMeeting(stranger as never, meetingRow().id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('marks an invitee accepted and returns the Meet URL', async () => {
    const participant = { status: MEETING_PARTICIPANT_STATUS.INVITED, save: vi.fn() };
    vi.mocked(MeetingParticipant.findOne).mockResolvedValue(participant as never);
    const result = await joinMeeting(invitee as never, meetingRow().id);
    expect(result.googleMeetUrl).toBe('https://meet.google.com/abc-defg-hij');
    expect(participant.status).toBe(MEETING_PARTICIPANT_STATUS.ACCEPTED);
    expect(participant.save).toHaveBeenCalled();
  });
});
