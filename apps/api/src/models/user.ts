import type {
  Department,
  Designation,
  PublicUser,
  Role,
  SessionUser,
  UserStatus,
} from '@teakflow/shared';
import { ROLES, USER_STATUS } from '@teakflow/shared';
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

const db = sequelize;

function asStringList<T extends string>(value: unknown): T[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is T => typeof item === 'string');
}

export class User extends Model {
  declare id: string;
  declare name: string;
  declare email: string;
  declare passwordHash: string;
  declare avatar: string | null;
  declare designation: string | null;
  declare department: string | null;
  declare companyId: string | null;
  declare role: Role;
  declare status: UserStatus;
  declare managerId: string | null;
  declare headedDepartments: Department[];
  declare extraDesignations: Designation[];
  declare lastSeenAt: Date | null;
  declare createdAt: Date;
  declare updatedAt: Date;

  toPublic(): PublicUser {
    return {
      ...this.toSession(),
      managerId: this.managerId,
      lastSeenAt: this.lastSeenAt?.toISOString() ?? null,
      createdAt: this.createdAt.toISOString(),
    };
  }

  toSession(): SessionUser {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      avatar: this.avatar,
      designation: this.designation,
      department: this.department,
      companyId: this.companyId,
      role: this.role,
      status: this.status,
      headedDepartments: asStringList<Department>(this.headedDepartments),
      extraDesignations: asStringList<Designation>(this.extraDesignations),
    };
  }
}

if (db) {
  User.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(80),
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING(120),
        allowNull: false,
        unique: true,
      },
      passwordHash: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      avatar: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      designation: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      department: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      companyId: {
        type: DataTypes.STRING(16),
        allowNull: true,
        unique: true,
      },
      role: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: ROLES.EMPLOYEE,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: USER_STATUS.ACTIVE,
      },
      managerId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      headedDepartments: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      extraDesignations: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      lastSeenAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize: db,
      tableName: 'users',
      underscored: true,
    },
  );
}
