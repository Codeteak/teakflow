import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

const db = sequelize;

export class SalesDayReport extends Model {
  declare id: string;
  declare userId: string;
  declare workDate: string;
  declare salesmanName: string;
  declare instCount: number;
  declare instShops: string;
  declare demoCount: number;
  declare demoShops: string;
  declare received: number;
  declare recShops: string;
  declare gst: string;
  declare paymentRef: string;
  declare bankName: string;
  declare amounts: string;
  declare modes: string;
  declare cash: number;
  declare cheque: number;
  declare upi: number;
  declare issues: string;
  declare updates: string;
  declare visits: number;
  declare visitShops: string;
  declare fuel: number;
  declare fuelLocked: boolean;
  declare notebookBlocks: string;
}

if (db) {
  SalesDayReport.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      workDate: { type: DataTypes.DATEONLY, allowNull: false },
      salesmanName: { type: DataTypes.STRING(80), allowNull: false },
      instCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      instShops: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
      demoCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      demoShops: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
      received: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      recShops: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
      gst: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
      paymentRef: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
      bankName: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
      amounts: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
      modes: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
      cash: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      cheque: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      upi: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      issues: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
      updates: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
      visits: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      visitShops: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
      fuel: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      fuelLocked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      notebookBlocks: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    },
    {
      sequelize: db,
      tableName: 'sales_day_reports',
      underscored: true,
      indexes: [{ unique: true, fields: ['user_id', 'work_date'] }],
    },
  );
}
