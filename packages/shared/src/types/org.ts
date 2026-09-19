import { DEPARTMENTS, ROLES, USER_STATUS } from '../constants/index';
import type { Department, PublicUser, Role } from './user';

/** Direct and nested reports of `rootId` (includes root). */
export function reportingTreeIds(people: Pick<PublicUser, 'id' | 'managerId'>[], rootId: string) {
  const ids = new Set<string>([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const person of people) {
      if (person.managerId && ids.has(person.managerId) && !ids.has(person.id)) {
        ids.add(person.id);
        grew = true;
      }
    }
  }
  return ids;
}

export function departmentOrder(priority: string[] = []) {
  const preferred = priority.filter((department) =>
    DEPARTMENTS.includes(department as (typeof DEPARTMENTS)[number]),
  );
  return [...preferred, ...DEPARTMENTS.filter((department) => !preferred.includes(department)), 'Other'];
}

/** Whether this manager/lead is the right reports-to for someone in `department`. */
export function alignsWithDepartment(
  person: Pick<PublicUser, 'role' | 'department' | 'headedDepartments'>,
  department: string | null | undefined,
) {
  if (!department) {
    return true;
  }
  if (person.role === ROLES.MANAGER) {
    const headed = person.headedDepartments ?? [];
    if (headed.length > 0) {
      return headed.includes(department as Department);
    }
    return person.department === department;
  }
  if (person.role === ROLES.LEAD) {
    return person.department === department;
  }
  return false;
}

export function reportsToCandidates(
  people: Pick<PublicUser, 'id' | 'name' | 'role' | 'status' | 'department' | 'headedDepartments'>[],
  subjectRole: Role,
  department: string | null | undefined,
  excludeId?: string,
) {
  const active = people.filter(
    (person) => person.status === USER_STATUS.ACTIVE && person.id !== excludeId,
  );
  const managers = active.filter(
    (person) => person.role === ROLES.MANAGER && alignsWithDepartment(person, department),
  );
  if (subjectRole === ROLES.LEAD) {
    return managers;
  }
  if (subjectRole === ROLES.EMPLOYEE) {
    const leads = active.filter(
      (person) => person.role === ROLES.LEAD && alignsWithDepartment(person, department),
    );
    return [...managers, ...leads];
  }
  return [];
}

export function reportsToLabel(person: Pick<PublicUser, 'name' | 'role' | 'department' | 'headedDepartments'>) {
  if (person.role === ROLES.MANAGER && person.headedDepartments?.length) {
    return `${person.name} · heads ${person.headedDepartments.join(', ')}`;
  }
  if (person.department) {
    return `${person.name} · ${person.department}`;
  }
  return person.name;
}
