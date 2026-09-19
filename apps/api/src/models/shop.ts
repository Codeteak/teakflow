import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

const db = sequelize;

export class Shop extends Model {
  declare id: string;
  declare shopId: string;
  declare name: string;
  declare place: string;
}

if (db) {
  Shop.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      shopId: { type: DataTypes.STRING(32), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(120), allowNull: false },
      place: { type: DataTypes.STRING(120), allowNull: false, defaultValue: '' },
    },
    { sequelize: db, tableName: 'shops', underscored: true },
  );
}
