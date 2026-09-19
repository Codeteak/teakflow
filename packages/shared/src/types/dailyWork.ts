import type { DAILY_WORK_STATUS } from '../constants/index';

export type DailyWorkStatus = (typeof DAILY_WORK_STATUS)[keyof typeof DAILY_WORK_STATUS];

export type DailyWorkEntry = {
  id: string;
  userId: string;
  workDate: string;
  content: string;
  status: DailyWorkStatus;
  submittedAt: string | null;
  isLate: boolean;
  createdAt: string;
};

export type DailyWorkTodayState =
  | 'LOCKED'
  | 'OPEN'
  | 'SUBMITTED_EDITABLE'
  | 'SUBMITTED'
  | 'LATE_AVAILABLE'
  | 'MISSED';

export type DailyWorkSettings = {
  startTime: string;
  endTime: string;
  minCharacters: number;
  maxCharacters: number;
  allowLateSubmission: boolean;
  reminderEnabled: boolean;
  reminderTime: string;
};

export type DailyWorkAdminSummary = {
  workDate: string;
  totalEmployees: number;
  submitted: number;
  pending: number;
  late: number;
  missed: number;
};

export type DailyWorkAdminRow = {
  userId: string;
  name: string;
  avatar: string | null;
  designation: string | null;
  department: string | null;
  status: DailyWorkStatus;
  submittedAt: string | null;
  entryId: string | null;
};

export type DailyWorkAdminView = DailyWorkAdminSummary & {
  rows: DailyWorkAdminRow[];
};

export type DailyWorkToday = {
  workDate: string;
  state: DailyWorkTodayState;
  timezone: string;
  settings: DailyWorkSettings;
  entry: DailyWorkEntry | null;
  salesNotebook: string;
};
