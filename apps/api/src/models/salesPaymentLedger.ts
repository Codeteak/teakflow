import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

const db = sequelize;

export class SalesPaymentLedger extends Model {
  declare id: string;
  declare year: number;
  declare month: string;
  declare shopId: string;
  declare shopName: string;
  declare place: string;
  declare amount: string;
  declare gst: string;
  declare status: string;
  declare paymentMode: string;
  declare date: string;
  declare reference: string;
  declare updatedBy: string | null;
  declare updatedAt: Date;
}

if (db) {
  SalesPaymentLedger.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      year: { type: DataTypes.INTEGER, allowNull: false },
      month: { type: DataTypes.STRING(12), allowNull: false },
      shopId: { type: DataTypes.STRING(32), allowNull: false },
      shopName: { type: DataTypes.STRING(200), allowNull: false, defaultValue: '' },
      place: { type: DataTypes.STRING(200), allowNull: false, defaultValue: '' },
      amount: { type: DataTypes.STRING(40), allowNull: false, defaultValue: '' },
      gst: { type: DataTypes.STRING(20), allowNull: false, defaultValue: '' },
      status: { type: DataTypes.STRING(40), allowNull: false, defaultValue: '' },
      paymentMode: { type: DataTypes.STRING(40), allowNull: false, defaultValue: '' },
      date: { type: DataTypes.STRING(32), allowNull: false, defaultValue: '' },
      reference: { type: DataTypes.STRING(80), allowNull: false, defaultValue: '' },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize: db,
      tableName: 'sales_payment_ledger',
      underscored: true,
      indexes: [{ unique: true, fields: ['year', 'month', 'shop_id'] }],
    },
  );
}
