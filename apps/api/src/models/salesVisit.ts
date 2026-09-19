import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

const db = sequelize;

export class SalesVisit extends Model {
  declare id: string;
  declare userId: string;
  declare workDate: string;
  declare shopId: string | null;
  declare shopName: string;
  declare place: string;
  declare listed: boolean;
  declare kind: string;
  declare count: number;
  declare notes: string;
}

if (db) {
  SalesVisit.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      workDate: { type: DataTypes.DATEONLY, allowNull: false },
      shopId: { type: DataTypes.STRING(32), allowNull: true },
      shopName: { type: DataTypes.STRING(200), allowNull: false, defaultValue: '' },
      place: { type: DataTypes.STRING(200), allowNull: false, defaultValue: '' },
      listed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      kind: { type: DataTypes.STRING(20), allowNull: false },
      count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      notes: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    },
    { sequelize: db, tableName: 'sales_visits', underscored: true },
  );
}
