import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NOTIFICATION_TYPE } from '@teakflow/shared';
import { Meeting } from '../../models/meeting';
import { MeetingParticipant } from '../../models/meetingParticipant';
import { createNotification } from '../notifications/index';
import { runMeetingReminders } from './reminders';

vi.mock('../../models/meeting', () => ({
  Meeting: {
    sequelize: {},
    findAll: vi.fn(),
  },
}));
vi.mock('../../models/meetingParticipant', () => ({
  MeetingParticipant: { findAll: vi.fn() },
}));
vi.mock('../notifications/index', () => ({
  createNotification: vi.fn(),
}));

describe('runMeetingReminders', () => {
  beforeEach(() => {
    vi.mocked(createNotification).mockResolvedValue({} as never);
  });

  it('notifies participants once when the meeting is 15 minutes away', async () => {
    const now = new Date('2026-09-18T10:15:00.000Z');
    const meeting = {
      id: 'meet-1',
      title: 'Frontend Discussion',
      startTime: new Date('2026-09-18T10:30:00.000Z'),
      reminderSentAt: null,
      save: vi.fn(),
    };
    vi.mocked(Meeting.findAll).mockResolvedValue([meeting] as never);
    vi.mocked(MeetingParticipant.findAll).mockResolvedValue([
      { userId: 'user-1' },
      { userId: 'user-2' },
    ] as never);
    await runMeetingReminders(now);
    expect(createNotification).toHaveBeenCalledTimes(2);
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: NOTIFICATION_TYPE.MEETING_REMINDER,
        referenceId: 'meet-1',
      }),
    );
    expect(meeting.save).toHaveBeenCalledTimes(1);

    meeting.reminderSentAt = now;
    vi.mocked(Meeting.findAll).mockResolvedValue([] as never);
    await runMeetingReminders(now);
    expect(createNotification).toHaveBeenCalledTimes(2);
  });
});
