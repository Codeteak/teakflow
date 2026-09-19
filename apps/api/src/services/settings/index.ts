import type {
  CompanySettings as CompanySettingsDto,
  UpdateDailyWorkWindowInput,
} from '@teakflow/shared';
import {
  AUDIT_ACTION,
  DEFAULT_COMPANY_SETTINGS,
  updateDailyWorkWindowSchema,
} from '@teakflow/shared';
import { COMPANY_SETTINGS_ID, CompanySettings } from '../../models/companySettings';
import { AppError } from '../../middlewares/errorHandler/index';
import { writeAudit } from '../audit/index';

const defaults = {
  id: COMPANY_SETTINGS_ID,
  companyName: DEFAULT_COMPANY_SETTINGS.companyName,
  timezone: DEFAULT_COMPANY_SETTINGS.timezone,
  dailyWorkStartTime: DEFAULT_COMPANY_SETTINGS.dailyWork.startTime,
  dailyWorkEndTime: DEFAULT_COMPANY_SETTINGS.dailyWork.endTime,
  dailyWorkMinCharacters: DEFAULT_COMPANY_SETTINGS.dailyWork.minCharacters,
  dailyWorkMaxCharacters: DEFAULT_COMPANY_SETTINGS.dailyWork.maxCharacters,
  dailyWorkAllowLateSubmission: DEFAULT_COMPANY_SETTINGS.dailyWork.allowLateSubmission,
  dailyWorkReminderEnabled: DEFAULT_COMPANY_SETTINGS.dailyWork.reminderEnabled,
  dailyWorkReminderTime: DEFAULT_COMPANY_SETTINGS.dailyWork.reminderTime,
};

export async function getCompanySettings(): Promise<CompanySettingsDto> {
  const [row] = await CompanySettings.findOrCreate({
    where: { id: COMPANY_SETTINGS_ID },
    defaults,
  });

  return row.toPublic();
}

export async function updateDailyWorkWindow(
  input: unknown,
  actorId?: string,
): Promise<CompanySettingsDto> {
  const parsed = updateDailyWorkWindowSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid submission window.';
    throw new AppError(400, 'VALIDATION_ERROR', message);
  }

  const data: UpdateDailyWorkWindowInput = parsed.data;
  await getCompanySettings();
  const row = await CompanySettings.findByPk(COMPANY_SETTINGS_ID);
  if (!row) {
    throw new AppError(500, 'SETTINGS_MISSING', 'Company settings could not be loaded.');
  }

  row.dailyWorkStartTime = data.startTime;
  row.dailyWorkEndTime = data.endTime;
  row.dailyWorkMinCharacters = data.minCharacters;
  row.dailyWorkMaxCharacters = data.maxCharacters;
  row.dailyWorkAllowLateSubmission = data.allowLateSubmission;
  row.dailyWorkReminderEnabled = data.reminderEnabled;
  row.dailyWorkReminderTime = data.reminderTime;
  row.timezone = data.timezone;
  await row.save();
  if (actorId) {
    void writeAudit({
      userId: actorId,
      action: AUDIT_ACTION.SETTINGS_UPDATED,
      entityType: 'company_settings',
      entityId: COMPANY_SETTINGS_ID,
      metadata: {
        startTime: data.startTime,
        endTime: data.endTime,
        timezone: data.timezone,
      },
    }).catch(() => undefined);
  }
  return row.toPublic();
}
