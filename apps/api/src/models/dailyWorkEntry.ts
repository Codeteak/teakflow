import type { DailyWorkStatus } from '@teakflow/shared';
import { DAILY_WORK_STATUS } from '@teakflow/shared';
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { AppError } from '../middlewares/errorHandler/index';
import { User } from './user';

const db = sequelize;

export class DailyWorkEntry extends Model {
  declare id: string;
  declare userId: string;
  declare workDate: string;
  declare content: string;
  declare status: DailyWorkStatus;
  declare submittedAt: Date | null;
  declare isLate: boolean;
  declare createdAt: Date;
  /** Set by the service when a same-day edit is allowed before the window ends. */
  declare allowWindowEdit?: boolean;

  toPublic() {
    return {
      id: this.id,
      userId: this.userId,
      workDate: this.workDate,
      content: this.content,
      status: this.status,
      submittedAt: this.submittedAt?.toISOString() ?? null,
      isLate: this.isLate,
      createdAt: this.createdAt.toISOString(),
    };
  }
}

if (db) {
  DailyWorkEntry.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      workDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: DAILY_WORK_STATUS.SUBMITTED,
      },
      submittedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      isLate: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      sequelize: db,
      tableName: 'daily_work_entries',
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ['user_id', 'work_date'],
        },
      ],
      hooks: {
        beforeUpdate(entry) {
          if (entry.submittedAt && entry.changed('content') && !entry.allowWindowEdit) {
            throw new AppError(
              409,
              'ENTRY_LOCKED',
              'This entry cannot be edited after the daily work window has closed.',
            );
          }
        },
      },
    },
  );

  DailyWorkEntry.belongsTo(User, { foreignKey: 'userId' });
  User.hasMany(DailyWorkEntry, { foreignKey: 'userId' });
}
