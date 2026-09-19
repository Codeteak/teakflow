import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { Conversation } from './conversation';
import { User } from './user';

const db = sequelize;

export class Message extends Model {
  declare id: string;
  declare conversationId: string;
  declare senderId: string;
  declare content: string;
  declare attachments: unknown;
  declare linkPreviews: unknown;
  declare replyToMessageId: string | null;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare editedAt: Date | null;
  declare deletedAt: Date | null;
}

if (db) {
  Message.init(
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
      senderId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      attachments: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      linkPreviews: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      replyToMessageId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      editedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize: db,
      tableName: 'messages',
      underscored: true,
      indexes: [
        {
          fields: ['conversation_id', 'created_at'],
        },
      ],
    },
  );

  Conversation.hasMany(Message, { foreignKey: 'conversationId' });
  Message.belongsTo(Conversation, { foreignKey: 'conversationId' });
  Message.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });
  Message.belongsTo(Message, { foreignKey: 'replyToMessageId', as: 'parent' });
}
