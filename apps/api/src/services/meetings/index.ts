import { Op } from 'sequelize';
import {
  AUDIT_ACTION,
  MEETING_PARTICIPANT_STATUS,
  NOTIFICATION_TYPE,
  ROLES,
  USER_STATUS,
  createMeetingSchema,
  type CreateMeetingInput,
  type Meeting as MeetingDto,
  type MeetingParticipant as MeetingParticipantDto,
  type SessionUser,
} from '@teakflow/shared';
import { assertCanInviteToMeeting } from '../users/scope';
import { ConversationMember } from '../../models/conversationMember';
import { Meeting } from '../../models/meeting';
import { MeetingParticipant } from '../../models/meetingParticipant';
import { User } from '../../models/user';
import { AppError } from '../../middlewares/errorHandler/index';
import { writeAudit } from '../audit/index';
import { createMessage } from '../chat/index';
import { createMeetEvent } from '../google/index';
import { createNotification } from '../notifications/index';

function requireDb() {
  if (!Meeting.sequelize) {
    throw new AppError(503, 'DATABASE_UNAVAILABLE', 'Database is not connected.');
  }
}

function toParticipant(row: MeetingParticipant, user?: User): MeetingParticipantDto {
  return {
    id: row.id,
    meetingId: row.meetingId,
    userId: row.userId,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    name: user?.name ?? 'Employee',
    email: user?.email ?? '',
  };
}

function toMeeting(row: Meeting, participants: MeetingParticipantDto[], creatorName: string): MeetingDto {
  return {
    id: row.id,
    title: row.title,
    createdBy: row.createdBy,
    createdByName: creatorName,
    googleMeetUrl: row.googleMeetUrl,
    googleEventId: row.googleEventId,
    startTime: row.startTime.toISOString(),
    endTime: row.endTime.toISOString(),
    conversationId: row.conversationId,
    reminderSentAt: row.reminderSentAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    participants,
  };
}

async function hydrate(row: Meeting): Promise<MeetingDto> {
  const participantRows = await MeetingParticipant.findAll({
    where: { meetingId: row.id },
    include: [{ model: User, as: 'user', attributes: { exclude: ['passwordHash'] } }],
  });
  const creator = await User.findByPk(row.createdBy, { attributes: ['name'] });
  return toMeeting(
    row,
    participantRows.map((item) => toParticipant(item, item.get('user') as User | undefined)),
    creator?.name ?? 'Employee',
  );
}

function canView(user: SessionUser, meeting: Meeting, participantIds: string[]) {
  if (user.role === ROLES.ADMIN) {
    return true;
  }
  return meeting.createdBy === user.id || participantIds.includes(user.id);
}

export async function listMeetings(user: SessionUser) {
  requireDb();
  const rows =
    user.role === ROLES.ADMIN
      ? await Meeting.findAll({ order: [['startTime', 'ASC']] })
      : await Meeting.findAll({
          include: [
            {
              model: MeetingParticipant,
              as: 'participants',
              required: true,
              where: { userId: user.id },
              attributes: [],
            },
          ],
          order: [['startTime', 'ASC']],
        });
  return Promise.all(rows.map((row) => hydrate(row)));
}

export async function getMeeting(user: SessionUser, id: string) {
  requireDb();
  const row = await Meeting.findByPk(id);
  if (!row) {
    throw new AppError(404, 'MEETING_NOT_FOUND', 'Meeting not found.');
  }
  const participants = await MeetingParticipant.findAll({ where: { meetingId: id } });
  if (!canView(user, row, participants.map((item) => item.userId))) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to do that.');
  }
  return hydrate(row);
}

export async function createMeeting(user: SessionUser, input: unknown) {
  requireDb();
  const parsed = createMeetingSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid meeting.');
  }
  const data: CreateMeetingInput = parsed.data;
  const participantIds = [...new Set([user.id, ...data.participantUserIds])];

  if (data.conversationId) {
    const member = await ConversationMember.findOne({
      where: { conversationId: data.conversationId, userId: user.id },
    });
    if (!member) {
      throw new AppError(403, 'NOT_A_MEMBER', 'You are not in this conversation.');
    }
  }

  const people = await User.findAll({
    where: { id: { [Op.in]: participantIds } },
  });
  if (people.length !== participantIds.length) {
    throw new AppError(400, 'PARTICIPANT_NOT_FOUND', 'One or more participants were not found.');
  }
  const inactive = people.find((person) => person.status !== USER_STATUS.ACTIVE);
  if (inactive) {
    throw new AppError(400, 'PARTICIPANT_INACTIVE', 'Inactive employees cannot be invited.');
  }

  await assertCanInviteToMeeting(user.id, user.role, participantIds);

  const startTime = new Date(data.startTime);
  const endTime = new Date(data.endTime);
  const google = await createMeetEvent({
    title: data.title,
    startTime,
    endTime,
    attendeeEmails: people.map((person) => person.email),
  });

  const meeting = await Meeting.create({
    title: data.title,
    createdBy: user.id,
    googleMeetUrl: google.meetUrl,
    googleEventId: google.eventId,
    startTime,
    endTime,
    conversationId: data.conversationId,
  });

  await MeetingParticipant.bulkCreate(
    participantIds.map((userId) => ({
      meetingId: meeting.id,
      userId,
      status: MEETING_PARTICIPANT_STATUS.INVITED,
    })),
  );

  await writeAudit({
    userId: user.id,
    action: AUDIT_ACTION.MEETING_CREATED,
    entityType: 'meeting',
    entityId: meeting.id,
    metadata: { title: data.title },
  });

  const when = startTime.toISOString();
  await Promise.all(
    participantIds
      .filter((id) => id !== user.id)
      .map((userId) =>
        createNotification({
          userId,
          type: NOTIFICATION_TYPE.MEETING_CREATED,
          title: `${user.name} created a meeting`,
          message: `${data.title} · ${when}`,
          referenceId: meeting.id,
        }),
      ),
  );

  if (data.conversationId && google.meetUrl) {
    await createMessage(user.id, data.conversationId, `${user.name} created a meeting`, null, {
      meeting: {
        kind: 'meeting',
        meetingId: meeting.id,
        title: data.title,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        googleMeetUrl: google.meetUrl,
      },
    });
  }

  return hydrate(meeting);
}

export async function joinMeeting(user: SessionUser, id: string) {
  requireDb();
  const meeting = await Meeting.findByPk(id);
  if (!meeting) {
    throw new AppError(404, 'MEETING_NOT_FOUND', 'Meeting not found.');
  }
  const participant = await MeetingParticipant.findOne({ where: { meetingId: id, userId: user.id } });
  if (!participant && user.role !== ROLES.ADMIN && meeting.createdBy !== user.id) {
    throw new AppError(403, 'FORBIDDEN', 'You were not invited to this meeting.');
  }
  if (!meeting.googleMeetUrl) {
    throw new AppError(503, 'MEET_URL_MISSING', 'This meeting does not have a Google Meet link.');
  }
  if (participant) {
    participant.status = MEETING_PARTICIPANT_STATUS.ACCEPTED;
    await participant.save();
  }
  return { googleMeetUrl: meeting.googleMeetUrl };
}
