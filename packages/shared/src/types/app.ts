import type { DailyWorkSettings } from './dailyWork';
import type { MEETING_PARTICIPANT_STATUS, NOTIFICATION_TYPE } from '../constants/index';

export type NotificationType = (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];

export type AppNotification = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  referenceId: string | null;
  isRead: boolean;
  createdAt: string;
};

export type MeetingParticipantStatus =
  (typeof MEETING_PARTICIPANT_STATUS)[keyof typeof MEETING_PARTICIPANT_STATUS];

export type MeetingParticipant = {
  id: string;
  meetingId: string;
  userId: string;
  status: MeetingParticipantStatus;
  createdAt: string;
  name: string;
  email: string;
};

export type Meeting = {
  id: string;
  title: string;
  createdBy: string;
  createdByName: string;
  googleMeetUrl: string | null;
  googleEventId: string | null;
  startTime: string;
  endTime: string;
  conversationId: string | null;
  reminderSentAt: string | null;
  createdAt: string;
  updatedAt: string;
  participants: MeetingParticipant[];
};

export type MeetingAttachment = {
  kind: 'meeting';
  meetingId: string;
  title: string;
  startTime: string;
  endTime: string;
  googleMeetUrl: string;
};

export type AuditLog = {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type CompanySettings = {
  companyName: string;
  timezone: string;
  dailyWork: DailyWorkSettings;
  googleConnected: boolean;
  googleConnectedEmail: string | null;
};
