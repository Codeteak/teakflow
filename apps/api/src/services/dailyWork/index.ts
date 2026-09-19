import type {
  DailyWorkAdminView,
  DailyWorkEntry as DailyWorkEntryDto,
  DailyWorkStatus,
  DailyWorkToday,
  Role,
} from '@teakflow/shared';
import { DAILY_WORK_STATUS, AUDIT_ACTION, submitDailyWorkSchema } from '@teakflow/shared';
import { UniqueConstraintError } from 'sequelize';
import { DailyWorkEntry } from '../../models/dailyWorkEntry';
import { SalesDayReport } from '../../models/salesDayReport';
import { AppError } from '../../middlewares/errorHandler/index';
import { writeAudit } from '../audit/index';
import { getCompanySettings } from '../settings/index';
import { mergeNotebook } from '../sales/notebook';
import { assertCanReadDailyWork, listTeamDailyWorkUsers } from '../users/scope';
import { clockParts, canEditSubmittedContent, resolveTodayState, windowPhase } from './window';

function assertCanSubmit(state: ReturnType<typeof resolveTodayState>) {
  if (state === 'LOCKED') {
    throw new AppError(403, 'WINDOW_CLOSED', 'Daily work submission is not open yet.');
  }
  if (state === 'MISSED') {
    throw new AppError(403, 'WINDOW_CLOSED', "Today's submission window has closed.");
  }
  if (state === 'SUBMITTED' || state === 'SUBMITTED_EDITABLE') {
    throw new AppError(409, 'ALREADY_SUBMITTED', "Today's daily work has already been submitted.");
  }
}

function assertContentLength(content: string, minCharacters: number) {
  if (!content) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Write what you worked on today.');
  }
  if (content.length < minCharacters) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      `Please enter at least ${minCharacters} characters.`,
    );
  }
}

export async function getToday(userId: string, now = new Date()): Promise<DailyWorkToday> {
  const settings = await getCompanySettings();
  const { workDate } = clockParts(now, settings.timezone);
  const entry = await DailyWorkEntry.findOne({ where: { userId, workDate } });
  const sales = await SalesDayReport.findOne({ where: { userId, workDate } });
  const state = resolveTodayState({
    now,
    timezone: settings.timezone,
    startTime: settings.dailyWork.startTime,
    endTime: settings.dailyWork.endTime,
    allowLateSubmission: settings.dailyWork.allowLateSubmission,
    submitted: Boolean(entry?.submittedAt),
  });

  return {
    workDate,
    state,
    timezone: settings.timezone,
    settings: settings.dailyWork,
    entry: entry?.toPublic() ?? null,
    salesNotebook: sales?.notebookBlocks ?? '',
  };
}

export async function submitToday(userId: string, input: unknown, now = new Date()) {
  const parsed = submitDailyWorkSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Write what you worked on today.');
  }

  const content = parsed.data.content.trim();
  const today = await getToday(userId, now);
  assertCanSubmit(today.state);

  const sales = await SalesDayReport.findOne({ where: { userId, workDate: today.workDate } });
  const merged = mergeNotebook(content, sales?.notebookBlocks ?? '');
  assertContentLength(merged, today.settings.minCharacters);

  const phase = windowPhase(now, today.timezone, today.settings.startTime, today.settings.endTime);
  const isLate = phase === 'AFTER';
  const status: DailyWorkStatus = isLate ? DAILY_WORK_STATUS.LATE : DAILY_WORK_STATUS.SUBMITTED;

  try {
    const entry = await DailyWorkEntry.create({
      userId,
      workDate: today.workDate,
      content: merged,
      status,
      submittedAt: now,
      isLate,
    });
    void writeAudit({
      userId,
      action: AUDIT_ACTION.DAILY_WORK_SUBMITTED,
      entityType: 'daily_work_entry',
      entityId: entry.id,
      metadata: { workDate: today.workDate, status },
    }).catch(() => undefined);
    return entry.toPublic();
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      throw new AppError(409, 'ALREADY_SUBMITTED', "Today's daily work has already been submitted.");
    }
    throw error;
  }
}

export async function updateToday(userId: string, input: unknown, now = new Date()) {
  const parsed = submitDailyWorkSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Write what you worked on today.');
  }

  const today = await getToday(userId, now);
  if (today.state !== 'SUBMITTED_EDITABLE' || !today.entry) {
    throw new AppError(
      403,
      'ENTRY_LOCKED',
      'Only today\'s submitted notebook can be edited, and only by you.',
    );
  }

  const content = parsed.data.content.trim();
  assertContentLength(content, today.settings.minCharacters);

  const entry = await DailyWorkEntry.findByPk(today.entry.id);
  if (!entry || entry.userId !== userId) {
    throw new AppError(404, 'NOT_FOUND', 'That daily work entry was not found.');
  }

  const entryDate =
    typeof entry.workDate === 'string'
      ? entry.workDate.slice(0, 10)
      : clockParts(new Date(entry.workDate), today.timezone).workDate;
  if (entryDate !== today.workDate || !canEditSubmittedContent(Boolean(entry.submittedAt))) {
    throw new AppError(403, 'ENTRY_LOCKED', 'Past daily work entries are locked.');
  }

  entry.allowWindowEdit = true;
  entry.content = content;
  await entry.save();
  return entry.toPublic();
}

export async function listHistory(userId: string): Promise<DailyWorkEntryDto[]> {
  return listHistoryForUser(userId, 'EMPLOYEE', userId);
}

export async function listHistoryForUser(
  actorId: string,
  actorRole: Role,
  targetUserId: string,
): Promise<DailyWorkEntryDto[]> {
  await assertCanReadDailyWork(actorId, actorRole, targetUserId);
  const entries = await DailyWorkEntry.findAll({
    where: { userId: targetUserId },
    order: [['workDate', 'DESC']],
  });
  return entries.map((entry) => entry.toPublic());
}

export async function getEntry(userId: string, entryId: string, role: Role): Promise<DailyWorkEntryDto> {
  const entry = await DailyWorkEntry.findByPk(entryId);
  if (!entry) {
    throw new AppError(404, 'NOT_FOUND', 'That daily work entry was not found.');
  }
  if (entry.userId !== userId) {
    await assertCanReadDailyWork(userId, role, entry.userId);
  }
  return entry.toPublic();
}

export async function getUserEntry(
  actorId: string,
  actorRole: Role,
  userId: string,
  workDate?: string,
  now = new Date(),
): Promise<DailyWorkEntryDto> {
  await assertCanReadDailyWork(actorId, actorRole, userId);
  const settings = await getCompanySettings();
  const date = workDate ?? clockParts(now, settings.timezone).workDate;
  const entry = await DailyWorkEntry.findOne({ where: { userId, workDate: date } });
  if (!entry) {
    throw new AppError(404, 'NOT_FOUND', 'No submission for that employee on this date.');
  }
  return entry.toPublic();
}

export async function getAdminView(
  actorId: string,
  actorRole: Role,
  now = new Date(),
  workDate?: string,
): Promise<DailyWorkAdminView> {
  const settings = await getCompanySettings();
  const today = clockParts(now, settings.timezone).workDate;
  const date = workDate ?? today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) {
    throw new AppError(400, 'INVALID_DATE', 'Choose a work date that is today or earlier.');
  }
  const phase =
    date < today
      ? 'AFTER'
      : windowPhase(now, settings.timezone, settings.dailyWork.startTime, settings.dailyWork.endTime);
  const employees = await listTeamDailyWorkUsers(actorId, actorRole);
  const scopeIds = employees.map((employee) => employee.id);
  const entries =
    scopeIds.length === 0
      ? []
      : await DailyWorkEntry.findAll({
          where: { workDate: date, userId: scopeIds },
        });
  const byUser = new Map(entries.map((entry) => [entry.userId, entry]));

  const rows = employees.map((employee) => {
    const entry = byUser.get(employee.id);
    let status: DailyWorkStatus = DAILY_WORK_STATUS.PENDING;
    if (entry?.isLate) {
      status = DAILY_WORK_STATUS.LATE;
    } else if (entry?.submittedAt) {
      status = DAILY_WORK_STATUS.SUBMITTED;
    } else if (phase === 'AFTER') {
      status = DAILY_WORK_STATUS.MISSED;
    }

    return {
      userId: employee.id,
      name: employee.name,
      avatar: employee.avatar,
      designation: employee.designation,
      department: employee.department,
      status,
      submittedAt: entry?.submittedAt?.toISOString() ?? null,
      entryId: entry?.id ?? null,
    };
  });

  return {
    workDate: date,
    totalEmployees: rows.length,
    submitted: rows.filter((row) => row.status === DAILY_WORK_STATUS.SUBMITTED).length,
    pending: rows.filter((row) => row.status === DAILY_WORK_STATUS.PENDING).length,
    late: rows.filter((row) => row.status === DAILY_WORK_STATUS.LATE).length,
    missed: rows.filter((row) => row.status === DAILY_WORK_STATUS.MISSED).length,
    rows,
  };
}
