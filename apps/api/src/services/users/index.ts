import bcrypt from 'bcryptjs';
import { Op, UniqueConstraintError } from 'sequelize';
import {
  AUDIT_ACTION,
  createUserSchema,
  updateUserSchema,
  USER_STATUS,
  ROLES,
} from '@teakflow/shared';
import type {
  CreateUserInput,
  PublicUser,
  SessionUser,
  UpdateUserInput,
} from '@teakflow/shared';
import { User } from '../../models/user';
import { AppError } from '../../middlewares/errorHandler/index';
import {
  addUserToMatchingPublicRooms,
  addUserToPublicChannels,
  removeUserFromDepartmentPublicRooms,
  removeUserFromManagerPublicRooms,
} from '../chat/index';
import { indexPerson } from '../search/index';
import { writeAudit } from '../audit/index';
import { revokeRefreshTokensForUser } from '../auth/index';
import { disconnectUserSockets } from '../../sockets/bus';
import { resolveManagerId, uniqueHeadedDepartments } from './scope';
import { nextCompanyId, roleNeedsCompanyId } from './companyId';

export async function listUsers(): Promise<PublicUser[]> {
  const users = await User.findAll({
    attributes: { exclude: ['passwordHash'] },
    order: [
      ['name', 'ASC'],
      ['email', 'ASC'],
    ],
  });
  return users.map((user) => user.toPublic());
}

export async function updateOwnAvatar(
  userId: string,
  avatar: string,
): Promise<SessionUser> {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
  }
  user.avatar = avatar;
  await user.save();
  return user.toSession();
}

export async function createUser(actorId: string, input: unknown): Promise<PublicUser> {
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid employee details.';
    throw new AppError(400, 'VALIDATION_ERROR', message);
  }

  const data: CreateUserInput = parsed.data;
  const passwordHash = await bcrypt.hash(data.password, 10);
  const managerId = await resolveManagerId(
    data.managerId,
    data.role,
    undefined,
    data.department,
  );
  const headedDepartments =
    data.role === ROLES.MANAGER
      ? await uniqueHeadedDepartments(null, data.headedDepartments ?? [])
      : [];
  const extraDesignations = [
    ...new Set(
      (data.extraDesignations ?? []).filter((item) => item !== data.designation),
    ),
  ];
  const companyId = roleNeedsCompanyId(data.role) ? await nextCompanyId() : null;

  try {
    const user = await User.create({
      name: data.name,
      email: data.email.trim().toLowerCase(),
      passwordHash,
      avatar: data.avatar ?? null,
      designation: data.designation,
      department: data.department,
      companyId,
      role: data.role,
      status: USER_STATUS.ACTIVE,
      managerId,
      headedDepartments,
      extraDesignations,
    });
    await addUserToPublicChannels(user.id);
    void indexPerson(user.toPublic()).catch(() => undefined);
    await writeAudit({
      userId: actorId,
      action: AUDIT_ACTION.EMPLOYEE_CREATED,
      entityType: 'user',
      entityId: user.id,
      metadata: { email: user.email, role: user.role, managerId, companyId },
    });
    return user.toPublic();
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      throw new AppError(
        409,
        'EMAIL_IN_USE',
        'An employee with this email already exists.',
      );
    }
    throw error;
  }
}

export async function updateUser(
  actorId: string,
  userId: string,
  input: unknown,
): Promise<PublicUser> {
  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid employee details.';
    throw new AppError(400, 'VALIDATION_ERROR', message);
  }

  const data: UpdateUserInput = parsed.data;
  const user = await User.findByPk(userId);
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  const previousManagerId = user.managerId;
  const previousDepartment = user.department;
  const nextRole = data.role ?? user.role;
  if (data.managerId !== undefined || data.role !== undefined) {
    user.managerId = await resolveManagerId(
      data.managerId !== undefined ? data.managerId : user.managerId,
      nextRole,
      user.id,
      data.department !== undefined ? data.department : user.department,
    );
  }
  if (data.name !== undefined) {
    user.name = data.name;
  }
  if (data.designation !== undefined) {
    user.designation = data.designation;
  }
  if (data.department !== undefined) {
    user.department = data.department;
  }
  if (data.role !== undefined) {
    user.role = data.role;
  }
  if (data.headedDepartments !== undefined || data.role !== undefined) {
    user.headedDepartments =
      user.role === ROLES.MANAGER
        ? await uniqueHeadedDepartments(
            user.id,
            data.headedDepartments ?? user.headedDepartments ?? [],
          )
        : [];
  }
  if (data.extraDesignations !== undefined) {
    const primary = data.designation ?? user.designation;
    user.extraDesignations = [
      ...new Set(data.extraDesignations.filter((item) => item !== primary)),
    ];
  }
  if (data.avatar !== undefined) {
    user.avatar = data.avatar;
  }
  if (data.status !== undefined) {
    if (data.status === USER_STATUS.INACTIVE) {
      if (userId === actorId) {
        throw new AppError(
          400,
          'CANNOT_RESTRICT_SELF',
          'You cannot restrict your own account.',
        );
      }
      if (user.role === ROLES.ADMIN) {
        const otherAdmins = await User.count({
          where: {
            role: ROLES.ADMIN,
            status: USER_STATUS.ACTIVE,
            id: { [Op.ne]: user.id },
          },
        });
        if (otherAdmins === 0) {
          throw new AppError(400, 'LAST_ADMIN', 'Keep at least one active admin.');
        }
      }
    }
    user.status = data.status;
  }

  if (user.role === ROLES.ADMIN) {
    user.companyId = null;
  } else if (!user.companyId) {
    user.companyId = await nextCompanyId();
  }

  await user.save();
  if (user.status === USER_STATUS.INACTIVE) {
    await revokeRefreshTokensForUser(user.id);
    disconnectUserSockets(user.id);
  }
  if (previousManagerId && previousManagerId !== user.managerId) {
    await removeUserFromManagerPublicRooms(user.id, previousManagerId);
  }
  if (previousDepartment && previousDepartment !== user.department) {
    await removeUserFromDepartmentPublicRooms(user.id, previousDepartment);
  }
  if (user.status === USER_STATUS.ACTIVE) {
    await addUserToMatchingPublicRooms(user);
  }
  await writeAudit({
    userId: actorId,
    action:
      data.status === USER_STATUS.INACTIVE
        ? AUDIT_ACTION.EMPLOYEE_DISABLED
        : AUDIT_ACTION.EMPLOYEE_UPDATED,
    entityType: 'user',
    entityId: user.id,
    metadata: {
      managerId: user.managerId,
      role: user.role,
      status: user.status,
      companyId: user.companyId,
    },
  });
  void indexPerson(user.toPublic()).catch(() => undefined);
  return user.toPublic();
}
