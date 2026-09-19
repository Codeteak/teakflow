import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { Conversation } from './conversation';
import { User } from './user';

const db = sequelize;

export class ConversationMember extends Model {
  declare id: string;
  declare conversationId: string;
  declare userId: string;
  declare joinedAt: Date;
  declare lastReadMessageId: string | null;
}

if (db) {
  ConversationMember.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      conversationId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      joinedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      lastReadMessageId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
    },
    {
      sequelize: db,
      tableName: 'conversation_members',
      underscored: true,
      timestamps: false,
      indexes: [
        {
          unique: true,
          fields: ['conversation_id', 'user_id'],
        },
        {
          fields: ['user_id'],
        },
      ],
    },
  );

  Conversation.hasMany(ConversationMember, {
    foreignKey: 'conversationId',
    as: 'memberships',
  });
  ConversationMember.belongsTo(Conversation, { foreignKey: 'conversationId' });
  ConversationMember.belongsTo(User, { foreignKey: 'userId' });
  User.hasMany(ConversationMember, { foreignKey: 'userId' });
}
