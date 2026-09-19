import { NOTIFICATION_TYPE, USER_STATUS } from '@teakflow/shared';
import { COMPANY_SETTINGS_ID, CompanySettings } from '../../models/companySettings';
import { DailyWorkEntry } from '../../models/dailyWorkEntry';
import { Notification } from '../../models/notification';
import { User } from '../../models/user';
import { getCompanySettings } from '../settings/index';
import { clockParts, timeToSeconds, windowPhase } from './window';

export async function runDailyWorkReminders(now = new Date()) {
  const settings = await getCompanySettings();
  const row = await CompanySettings.findByPk(COMPANY_SETTINGS_ID);
  if (!row) {
    return;
  }

  const { workDate, seconds } = clockParts(now, settings.timezone);
  const phase = windowPhase(
    now,
    settings.timezone,
    settings.dailyWork.startTime,
    settings.dailyWork.endTime,
  );
  const users = await User.findAll({ where: { status: USER_STATUS.ACTIVE } });

  if (phase !== 'BEFORE' && row.dailyWorkOpenNotifiedOn !== workDate) {
    await Notification.bulkCreate(
      users.map((user) => ({
        userId: user.id,
        type: NOTIFICATION_TYPE.DAILY_WORK_OPEN,
        title: 'Daily Work',
        message: 'Your daily work submission window is now open.',
        referenceId: null,
        isRead: false,
      })),
    );
    row.dailyWorkOpenNotifiedOn = workDate;
    await row.save();
  }

  const reminderSeconds = timeToSeconds(settings.dailyWork.reminderTime);
  if (
    settings.dailyWork.reminderEnabled &&
    seconds >= reminderSeconds &&
    phase !== 'BEFORE' &&
    row.dailyWorkReminderNotifiedOn !== workDate
  ) {
    const submitted = await DailyWorkEntry.findAll({ where: { workDate } });
    const submittedIds = new Set(submitted.map((entry) => entry.userId));
    const pending = users.filter((user) => !submittedIds.has(user.id));
    if (pending.length > 0) {
      await Notification.bulkCreate(
        pending.map((user) => ({
          userId: user.id,
          type: NOTIFICATION_TYPE.DAILY_WORK_REMINDER,
          title: 'Reminder',
          message: `You haven't submitted today's daily work yet. Submission closes at ${settings.dailyWork.endTime}.`,
          referenceId: null,
          isRead: false,
        })),
      );
    }
    row.dailyWorkReminderNotifiedOn = workDate;
    await row.save();
  }
}
