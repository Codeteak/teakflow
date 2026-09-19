import type {
  CompanySettings as CompanySettingsDto,
  DailyWorkSettings,
} from '@teakflow/shared';
import { DEFAULT_COMPANY_SETTINGS } from '@teakflow/shared';
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

const db = sequelize;
const SINGLETON_ID = '00000000-0000-4000-8000-000000000001';

export class CompanySettings extends Model {
  declare id: string;
  declare companyName: string;
  declare timezone: string;
  declare dailyWorkStartTime: string;
  declare dailyWorkEndTime: string;
  declare dailyWorkMinCharacters: number;
  declare dailyWorkMaxCharacters: number;
  declare dailyWorkAllowLateSubmission: boolean;
  declare dailyWorkReminderEnabled: boolean;
  declare dailyWorkReminderTime: string;
  declare dailyWorkOpenNotifiedOn: string | null;
  declare dailyWorkReminderNotifiedOn: string | null;
  declare googleRefreshToken: string | null;
  declare googleConnectedEmail: string | null;

  toPublic(): CompanySettingsDto {
    const dailyWork: DailyWorkSettings = {
      startTime: this.dailyWorkStartTime,
      endTime: this.dailyWorkEndTime,
      minCharacters: this.dailyWorkMinCharacters,
      maxCharacters: this.dailyWorkMaxCharacters,
      allowLateSubmission: this.dailyWorkAllowLateSubmission,
      reminderEnabled: this.dailyWorkReminderEnabled,
      reminderTime: this.dailyWorkReminderTime,
    };

    return {
      companyName: this.companyName,
      timezone: this.timezone,
      dailyWork,
      googleConnected: Boolean(this.googleRefreshToken),
      googleConnectedEmail: this.googleConnectedEmail,
    };
  }
}

if (db) {
  CompanySettings.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: SINGLETON_ID,
      },
      companyName: {
        type: DataTypes.STRING(80),
        allowNull: false,
        defaultValue: DEFAULT_COMPANY_SETTINGS.companyName,
      },
      timezone: {
        type: DataTypes.STRING(64),
        allowNull: false,
        defaultValue: DEFAULT_COMPANY_SETTINGS.timezone,
      },
      dailyWorkStartTime: {
        type: DataTypes.STRING(5),
        allowNull: false,
        defaultValue: DEFAULT_COMPANY_SETTINGS.dailyWork.startTime,
      },
      dailyWorkEndTime: {
        type: DataTypes.STRING(5),
        allowNull: false,
        defaultValue: DEFAULT_COMPANY_SETTINGS.dailyWork.endTime,
      },
      dailyWorkMinCharacters: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: DEFAULT_COMPANY_SETTINGS.dailyWork.minCharacters,
      },
      dailyWorkMaxCharacters: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: DEFAULT_COMPANY_SETTINGS.dailyWork.maxCharacters,
      },
      dailyWorkAllowLateSubmission: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: DEFAULT_COMPANY_SETTINGS.dailyWork.allowLateSubmission,
      },
      dailyWorkReminderEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: DEFAULT_COMPANY_SETTINGS.dailyWork.reminderEnabled,
      },
      dailyWorkReminderTime: {
        type: DataTypes.STRING(5),
        allowNull: false,
        defaultValue: DEFAULT_COMPANY_SETTINGS.dailyWork.reminderTime,
      },
      dailyWorkOpenNotifiedOn: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      dailyWorkReminderNotifiedOn: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      googleRefreshToken: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      googleConnectedEmail: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
    },
    {
      sequelize: db,
      tableName: 'company_settings',
      underscored: true,
    },
  );
}

export const COMPANY_SETTINGS_ID = SINGLETON_ID;
