export const ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  LEAD: 'LEAD',
  EMPLOYEE: 'EMPLOYEE',
} as const;

export const ROLE_VALUES = ['ADMIN', 'MANAGER', 'LEAD', 'EMPLOYEE'] as const;

export function isTeamSupervisorRole(role: string) {
  return role === ROLES.ADMIN || role === ROLES.MANAGER || role === ROLES.LEAD;
}

/** Job title on the employee profile. Not an access role. */
export const DESIGNATIONS = [
  'Administrator',
  'Project Manager',
  'Product Manager',
  'Assistant Manager',
  'Frontend Developer',
  'Frontend Lead',
  'Backend Developer',
  'Backend Lead',
  'Full Stack Developer',
  'UI/UX Designer',
  'Design Lead',
  'QA Engineer',
  'QA Lead',
  'DevOps Engineer',
  'Sales Executive',
  'Business Development Executive',
  'Inside Sales Executive',
  'Account Executive',
  'Senior Sales Executive',
  'Sales Manager',
  'Key Account Manager',
  'Pre-Sales Consultant',
  'Sales Operations',
] as const;

export const DEPARTMENTS = [
  'Engineering',
  'Design',
  'Product',
  'QA',
  'Operations',
  'Sales',
] as const;

export const USER_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;

export const ACCOUNT_RESTRICTED_MESSAGE =
  'You are restricted from company. contact admin or your manager for the access';

export const DAILY_WORK_STATUS = {
  PENDING: 'PENDING',
  SUBMITTED: 'SUBMITTED',
  LATE: 'LATE',
  MISSED: 'MISSED',
} as const;

export const CONVERSATION_TYPE = {
  DIRECT: 'DIRECT',
  GROUP: 'GROUP',
  CHANNEL: 'CHANNEL',
} as const;

export const CHANNEL_VISIBILITY = {
  PUBLIC: 'PUBLIC',
  PRIVATE: 'PRIVATE',
} as const;

export const MEETING_PARTICIPANT_STATUS = {
  INVITED: 'INVITED',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
} as const;

export const NOTIFICATION_TYPE = {
  MESSAGE: 'MESSAGE',
  MENTION: 'MENTION',
  REACTION: 'REACTION',
  MEETING_CREATED: 'MEETING_CREATED',
  MEETING_REMINDER: 'MEETING_REMINDER',
  DAILY_WORK_OPEN: 'DAILY_WORK_OPEN',
  DAILY_WORK_REMINDER: 'DAILY_WORK_REMINDER',
} as const;

export const AUDIT_ACTION = {
  DAILY_WORK_SUBMITTED: 'DAILY_WORK_SUBMITTED',
  EMPLOYEE_CREATED: 'EMPLOYEE_CREATED',
  EMPLOYEE_UPDATED: 'EMPLOYEE_UPDATED',
  EMPLOYEE_DISABLED: 'EMPLOYEE_DISABLED',
  CHANNEL_CREATED: 'CHANNEL_CREATED',
  MESSAGE_DELETED: 'MESSAGE_DELETED',
  MEETING_CREATED: 'MEETING_CREATED',
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
  SALES_PAYMENT_PATCH: 'SALES_PAYMENT_PATCH',
  SALES_SHOP_UPSERT: 'SALES_SHOP_UPSERT',
  SALES_SHOP_DELETE: 'SALES_SHOP_DELETE',
} as const;

export const SALES_VISIT_KIND = {
  INSTALLATION: 'INSTALLATION',
  DEMO: 'DEMO',
  VISIT: 'VISIT',
} as const;

export const SALES_DAILY_CSV_HEADERS = [
  'Date',
  'Salesman',
  'Inst.',
  'Inst. Shop',
  'Demo',
  'Demo Shop',
  'Received',
  'Rec. Shop',
  'GST',
  'Payment Ref',
  'Bank Name',
  'Cash',
  'Cheque',
  'UPI',
  'Issues',
  'Updates',
  'Visits',
  'Visit Shop',
  'Fuel',
] as const;

export const SALES_PAYMENT_HEADERS = [
  'ID',
  'SHOP NAME',
  'PLACE',
  'AMOUNT',
  'GST',
  'STATUS',
  'PAYMENT MODE',
  'DATE',
  'REFERNCE NO',
] as const;

export const SALES_MONTH_TABS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
] as const;

export const SALES_PAYMENT_FILE_PREFIX = 'monthly payment';

/** Same first three columns as the monthly payment workbook so a sheet copy upserts the directory. */
export const SALES_SHOP_CSV_HEADERS = ['ID', 'SHOP NAME', 'PLACE'] as const;

export const PRESENCE_STATUS = {
  ONLINE: 'ONLINE',
  AWAY: 'AWAY',
  DND: 'DND',
  OFFLINE: 'OFFLINE',
} as const;

export const DEFAULT_REACTIONS = ['👍', '❤️', '😂', '🚀', '👀', '✅'] as const;

export const DEFAULT_CHANNELS = [
  'general',
  'announcements',
  'frontend',
  'backend',
  'design',
  'qa',
] as const;

export const DEFAULT_COMPANY_SETTINGS = {
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
  googleConnectedEmail: null as string | null,
} as const;

export const SOCKET_EVENTS = {
  MESSAGE_NEW: 'message:new',
  MESSAGE_SEND: 'message:send',
  MESSAGE_UPDATE: 'message:update',
  MESSAGE_DELETE: 'message:delete',
  MESSAGE_REACTION: 'message:reaction',
  MESSAGE_READ: 'message:read',
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',
  USER_ONLINE: 'user:online',
  USER_OFFLINE: 'user:offline',
  /** Full presence payload: ONLINE | AWAY | DND | OFFLINE */
  USER_PRESENCE: 'user:presence',
  /** Client asks to set own presence while connected (ONLINE | AWAY | DND). */
  PRESENCE_SET: 'presence:set',
  NOTIFICATION_NEW: 'notification:new',
  SESSION_ENDED: 'session:ended',
} as const;

export const API_PREFIX = '/api/v1';

export const STORAGE_BUCKETS = {
  AVATARS: 'avatars',
  CHAT: 'chat',
  FILES: 'files',
} as const;
