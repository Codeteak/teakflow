import { COMPANY_SETTINGS_ID, CompanySettings } from './companySettings';
import { DailyWorkEntry } from './dailyWorkEntry';
import { Notification } from './notification';
import { Conversation } from './conversation';
import { ConversationMember } from './conversationMember';
import { Message } from './message';
import { MessageReaction } from './messageReaction';
import { Meeting } from './meeting';
import { MeetingParticipant } from './meetingParticipant';
import { AuditLog } from './auditLog';
import { sequelize } from '../config/database';
import { Shop } from './shop';
import { SalesVisit } from './salesVisit';
import { SalesDayReport } from './salesDayReport';
import { SalesPaymentReceived } from './salesPaymentReceived';
import { SalesPaymentLedger } from './salesPaymentLedger';
import { User } from './user';
import { RefreshToken } from './refreshToken';
import { env } from '../config/env';

export {
  sequelize,
  User,
  RefreshToken,
  CompanySettings,
  COMPANY_SETTINGS_ID,
  DailyWorkEntry,
  Notification,
  Conversation,
  ConversationMember,
  Message,
  MessageReaction,
  Meeting,
  MeetingParticipant,
  AuditLog,
  Shop,
  SalesVisit,
  SalesDayReport,
  SalesPaymentReceived,
  SalesPaymentLedger,
};

export async function syncModels() {
  if (!sequelize) {
    return false;
  }

  AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'actor' });
  User.hasMany(AuditLog, { foreignKey: 'userId', as: 'auditLogs' });

  await sequelize.sync({ alter: env.NODE_ENV !== 'production' });
  return true;
}
