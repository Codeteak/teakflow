import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

const db = sequelize;

export class SalesPaymentReceived extends Model {
  declare id: string;
  declare userId: string;
  declare workDate: string;
  declare shopId: string | null;
  declare shopName: string;
  declare amount: number;
  declare gst: string;
  declare ref: string;
  declare mode: string;
  declare bankName: string;
}

if (db) {
  SalesPaymentReceived.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      workDate: { type: DataTypes.DATEONLY, allowNull: false },
      shopId: { type: DataTypes.STRING(32), allowNull: true },
      shopName: { type: DataTypes.STRING(200), allowNull: false },
      amount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      gst: { type: DataTypes.STRING(20), allowNull: false },
      ref: { type: DataTypes.STRING(80), allowNull: false, defaultValue: '' },
      mode: { type: DataTypes.STRING(20), allowNull: false },
      bankName: { type: DataTypes.STRING(80), allowNull: false, defaultValue: '' },
    },
    { sequelize: db, tableName: 'sales_payments_received', underscored: true },
  );
}
