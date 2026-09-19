import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { Message } from './message';
import { User } from './user';

const db = sequelize;

export class MessageReaction extends Model {
  declare id: string;
  declare messageId: string;
  declare userId: string;
  declare reaction: string;
  declare createdAt: Date;
}

if (db) {
  MessageReaction.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      messageId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      reaction: {
        type: DataTypes.STRING(32),
        allowNull: false,
      },
    },
    {
      sequelize: db,
      tableName: 'message_reactions',
      underscored: true,
      updatedAt: false,
      indexes: [
        {
          unique: true,
          fields: ['message_id', 'user_id', 'reaction'],
        },
      ],
    },
  );

  Message.hasMany(MessageReaction, { foreignKey: 'messageId', as: 'reactions' });
  MessageReaction.belongsTo(Message, { foreignKey: 'messageId' });
  MessageReaction.belongsTo(User, { foreignKey: 'userId' });
}
