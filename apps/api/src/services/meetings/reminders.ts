import { Op } from 'sequelize';
import { NOTIFICATION_TYPE } from '@teakflow/shared';
import { Meeting } from '../../models/meeting';
import { MeetingParticipant } from '../../models/meetingParticipant';
import { createNotification } from '../notifications/index';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

export async function runMeetingReminders(now = new Date()) {
  if (!Meeting.sequelize) {
    return;
  }
  const windowEnd = new Date(now.getTime() + FIFTEEN_MINUTES_MS);
  const rows = await Meeting.findAll({
    where: {
      reminderSentAt: null,
      startTime: {
        [Op.gt]: now,
        [Op.lte]: windowEnd,
      },
    },
  });

  for (const meeting of rows) {
    const participants = await MeetingParticipant.findAll({ where: { meetingId: meeting.id } });
    await Promise.all(
      participants.map((person) =>
        createNotification({
          userId: person.userId,
          type: NOTIFICATION_TYPE.MEETING_REMINDER,
          title: 'Meeting reminder',
          message: `${meeting.title} starts in 15 minutes`,
          referenceId: meeting.id,
        }),
      ),
    );
    meeting.reminderSentAt = now;
    await meeting.save();
  }
}
