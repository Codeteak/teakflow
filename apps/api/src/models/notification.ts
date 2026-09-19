import type { NotificationType } from '@teakflow/shared';
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { User } from './user';

const db = sequelize;

export class Notification extends Model {
  declare id: string;
  declare userId: string;
  declare type: NotificationType;
  declare title: string;
  declare message: string;
  declare referenceId: string | null;
  declare isRead: boolean;
  declare createdAt: Date;
}

if (db) {
  Notification.init(
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
      type: {
        type: DataTypes.STRING(40),
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      message: {
        type: DataTypes.STRING(400),
        allowNull: false,
      },
      referenceId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      isRead: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      sequelize: db,
      tableName: 'notifications',
      underscored: true,
    },
  );

  Notification.belongsTo(User, { foreignKey: 'userId' });
}
