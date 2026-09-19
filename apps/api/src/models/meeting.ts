import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { User } from './user';

const db = sequelize;

export class Meeting extends Model {
  declare id: string;
  declare title: string;
  declare createdBy: string;
  declare googleMeetUrl: string | null;
  declare googleEventId: string | null;
  declare startTime: Date;
  declare endTime: Date;
  declare conversationId: string | null;
  declare reminderSentAt: Date | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

if (db) {
  Meeting.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      title: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      createdBy: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      googleMeetUrl: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      googleEventId: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      startTime: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      endTime: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      conversationId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      reminderSentAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize: db,
      tableName: 'meetings',
      underscored: true,
      indexes: [{ fields: ['start_time'] }, { fields: ['created_by'] }],
    },
  );

  Meeting.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
}
