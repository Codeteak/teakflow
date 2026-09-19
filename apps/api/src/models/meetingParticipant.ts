import { MEETING_PARTICIPANT_STATUS } from '@teakflow/shared';
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { Meeting } from './meeting';
import { User } from './user';

const db = sequelize;

export class MeetingParticipant extends Model {
  declare id: string;
  declare meetingId: string;
  declare userId: string;
  declare status: (typeof MEETING_PARTICIPANT_STATUS)[keyof typeof MEETING_PARTICIPANT_STATUS];
  declare createdAt: Date;
}

if (db) {
  MeetingParticipant.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      meetingId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: MEETING_PARTICIPANT_STATUS.INVITED,
      },
    },
    {
      sequelize: db,
      tableName: 'meeting_participants',
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ['meeting_id', 'user_id'],
        },
      ],
    },
  );

  Meeting.hasMany(MeetingParticipant, { foreignKey: 'meetingId', as: 'participants' });
  MeetingParticipant.belongsTo(Meeting, { foreignKey: 'meetingId' });
  MeetingParticipant.belongsTo(User, { foreignKey: 'userId', as: 'user' });
}
