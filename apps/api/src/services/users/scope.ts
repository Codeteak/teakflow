import { Op, type WhereOptions } from 'sequelize';
import {
  alignsWithDepartment,
  reportingTreeIds,
  ROLES,
  USER_STATUS,
} from '@teakflow/shared';
import type { Department, Role } from '@teakflow/shared';
import { User } from '../../models/user';
import { AppError } from '../../middlewares/errorHandler/index';

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

function asUserId(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return null;
}

export async function teamScopeUserIds(
  actorId: string,
  actorRole: Role,
): Promise<string[] | null> {
  if (actorRole === ROLES.ADMIN) {
    return null;
  }
  if (actorRole !== ROLES.MANAGER && actorRole !== ROLES.LEAD) {
    return [actorId];
  }
  const people = await User.findAll({
    where: { status: USER_STATUS.ACTIVE },
    attributes: ['id', 'managerId'],
  });
  const tree = reportingTreeIds(
    (people ?? []).map((person) => ({
      id: person.id,
      managerId: asUserId(person.managerId),
    })),
    actorId,
  );
  return [...tree];
}

export async function listTeamDailyWorkUsers(actorId: string, actorRole: Role) {
  if (
    actorRole !== ROLES.ADMIN &&
    actorRole !== ROLES.MANAGER &&
    actorRole !== ROLES.LEAD
  ) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to do that.');
  }
  const people = await User.findAll({
    where: { status: USER_STATUS.ACTIVE },
    order: [['name', 'ASC']],
  });
  if (actorRole === ROLES.ADMIN) {
    return people;
  }
  const allowed = reportingTreeIds(
    people.map((person) => ({
      id: person.id,
      managerId: asUserId(person.managerId),
    })),
    actorId,
  );
  return people.filter((person) => allowed.has(person.id));
}

export async function teamDailyWorkWhere(
  actorId: string,
  actorRole: Role,
): Promise<WhereOptions> {
  if (actorRole === ROLES.ADMIN) {
    return { status: USER_STATUS.ACTIVE };
  }
  const ids = await teamScopeUserIds(actorId, actorRole);
  return {
    status: USER_STATUS.ACTIVE,
    id: { [Op.in]: ids ?? [actorId] },
  };
}

export async function assertCanReadDailyWork(
  actorId: string,
  actorRole: Role,
  targetUserId: string,
): Promise<void> {
  if (actorId === targetUserId) {
    return;
  }
  if (actorRole === ROLES.ADMIN) {
    return;
  }
  if (actorRole !== ROLES.MANAGER && actorRole !== ROLES.LEAD) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to do that.');
  }
  const ids = await teamScopeUserIds(actorId, actorRole);
  if (!ids?.includes(targetUserId)) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'You can only view daily work for people in your team.',
    );
  }
}

export async function assertCanInviteToMeeting(
  actorId: string,
  actorRole: Role,
  participantIds: string[],
): Promise<void> {
  if (actorRole === ROLES.ADMIN || actorRole === ROLES.EMPLOYEE) {
    return;
  }
  const ids = await teamScopeUserIds(actorId, actorRole);
  const allowed = new Set(ids ?? [actorId]);
  const outside = participantIds.filter((id) => id !== actorId && !allowed.has(id));
  if (outside.length > 0) {
    throw new AppError(
      403,
      'PARTICIPANT_OUT_OF_SCOPE',
      'You can only invite people in your team.',
    );
  }
}

export async function resolveManagerId(
  managerId: string | null | undefined,
  subjectRole: Role,
  subjectId?: string,
  subjectDepartment?: string | null,
): Promise<string | null> {
  if (subjectRole === ROLES.ADMIN || subjectRole === ROLES.MANAGER) {
    return null;
  }
  if (!managerId) {
    return null;
  }
  if (subjectId && managerId === subjectId) {
    throw new AppError(400, 'INVALID_MANAGER', 'A person cannot report to themselves.');
  }
  const boss = await User.findByPk(managerId);
  if (!boss || boss.status !== USER_STATUS.ACTIVE) {
    throw new AppError(400, 'INVALID_MANAGER', 'Choose an active manager or lead.');
  }
  if (subjectRole === ROLES.LEAD && boss.role !== ROLES.MANAGER) {
    throw new AppError(400, 'INVALID_MANAGER', 'A lead reports to a manager.');
  }
  if (
    subjectRole === ROLES.EMPLOYEE &&
    boss.role !== ROLES.MANAGER &&
    boss.role !== ROLES.LEAD
  ) {
    throw new AppError(
      400,
      'INVALID_MANAGER',
      'An employee reports to a lead or a manager.',
    );
  }
  if (
    subjectDepartment &&
    !alignsWithDepartment(
      {
        role: boss.role,
        department: boss.department,
        headedDepartments: boss.headedDepartments ?? [],
      },
      subjectDepartment,
    )
  ) {
    throw new AppError(
      400,
      'INVALID_MANAGER',
      'Choose a manager or lead for that department.',
    );
  }
  if (subjectId) {
    let cursor: string | null = boss.managerId;
    const seen = new Set<string>([boss.id]);
    while (cursor) {
      if (cursor === subjectId) {
        throw new AppError(
          400,
          'INVALID_MANAGER',
          'That reports-to choice would create a cycle.',
        );
      }
      if (seen.has(cursor)) {
        break;
      }
      seen.add(cursor);
      const next = await User.findByPk(cursor);
      cursor = next?.managerId ?? null;
    }
  }
  return boss.id;
}

export async function uniqueHeadedDepartments(
  userId: string | null,
  departments: Department[],
): Promise<Department[]> {
  const unique = [...new Set(departments)];
  if (unique.length === 0) {
    return [];
  }
  const managers = await User.findAll({
    where: { role: ROLES.MANAGER, status: USER_STATUS.ACTIVE },
    attributes: ['id', 'headedDepartments', 'name'],
  });
  for (const department of unique) {
    const taken = managers.find(
      (manager) =>
        manager.id !== userId &&
        asStringList(manager.headedDepartments).includes(department),
    );
    if (taken) {
      throw new AppError(
        409,
        'DEPARTMENT_HEADED',
        `${department} is already headed by ${taken.name}. One manager per department.`,
      );
    }
  }
  return unique;
}
