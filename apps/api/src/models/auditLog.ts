import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

const db = sequelize;

export class AuditLog extends Model {
  declare id: string;
  declare userId: string;
  declare action: string;
  declare entityType: string;
  declare entityId: string;
  declare metadata: Record<string, unknown> | null;
  declare createdAt: Date;
}

if (db) {
  AuditLog.init(
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
      action: {
        type: DataTypes.STRING(60),
        allowNull: false,
      },
      entityType: {
        type: DataTypes.STRING(40),
        allowNull: false,
      },
      entityId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
    },
    {
      sequelize: db,
      tableName: 'audit_logs',
      underscored: true,
      updatedAt: false,
    },
  );
}
