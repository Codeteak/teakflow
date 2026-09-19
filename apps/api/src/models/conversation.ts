import type { ChannelVisibility, ConversationType } from '@teakflow/shared';
import { CHANNEL_VISIBILITY, CONVERSATION_TYPE } from '@teakflow/shared';
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { User } from './user';

const db = sequelize;

export class Conversation extends Model {
  declare id: string;
  declare type: ConversationType;
  declare name: string | null;
  declare visibility: ChannelVisibility | null;
  declare department: string | null;
  declare createdBy: string;
  declare createdAt: Date;
  declare updatedAt: Date;
}

if (db) {
  Conversation.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: CONVERSATION_TYPE.DIRECT,
      },
      name: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      visibility: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: CHANNEL_VISIBILITY.PUBLIC,
      },
      department: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      createdBy: {
        type: DataTypes.UUID,
        allowNull: false,
      },
    },
    {
      sequelize: db,
      tableName: 'conversations',
      underscored: true,
    },
  );

  Conversation.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
}
