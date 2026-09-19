import { isTeamSupervisorRole, ROLES, type Role, type SessionUser } from '@teakflow/shared';
import { AppError } from '../../middlewares/errorHandler/index';
import { User } from '../../models/user';
import { listTeamDailyWorkUsers, teamScopeUserIds } from '../users/scope';

export function canOpenSales(user: Pick<SessionUser, 'role' | 'department' | 'headedDepartments'>) {
  if (user.role === ROLES.ADMIN || isTeamSupervisorRole(user.role)) {
    return true;
  }
  if (user.department === 'Sales') {
    return true;
  }
  return (user.headedDepartments ?? []).includes('Sales');
}

export function canManageShops(user: Pick<SessionUser, 'role' | 'department' | 'headedDepartments'>) {
  return canOpenSales(user) && isTeamSupervisorRole(user.role);
}

export function assertCanManageShops(user: SessionUser) {
  assertCanOpenSales(user);
  if (!canManageShops(user)) {
    throw new AppError(403, 'FORBIDDEN', 'Only admin, manager, or lead can change the shop directory.');
  }
}

export function assertCanOpenSales(user: SessionUser) {
  if (!canOpenSales(user)) {
    throw new AppError(403, 'FORBIDDEN', 'Sales is only for the Sales team.');
  }
}

export async function salesScopeUserIds(actorId: string, actorRole: Role): Promise<string[] | null> {
  if (actorRole === ROLES.ADMIN) {
    return null;
  }
  if (actorRole === ROLES.EMPLOYEE) {
    return [actorId];
  }
  return teamScopeUserIds(actorId, actorRole);
}

export async function listSalesPeople(actorId: string, actorRole: Role) {
  if (actorRole === ROLES.EMPLOYEE) {
    const self = await User.findByPk(actorId);
    return self ? [self] : [];
  }
  const people = await listTeamDailyWorkUsers(actorId, actorRole);
  return people.filter((person) =>
    canOpenSales({
      role: person.role,
      department: person.department,
      headedDepartments: person.headedDepartments ?? [],
    }),
  );
}
