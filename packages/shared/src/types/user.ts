import type { DEPARTMENTS, DESIGNATIONS, ROLES, USER_STATUS } from '../constants/index';

export type Role = (typeof ROLES)[keyof typeof ROLES];
export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];
export type Designation = (typeof DESIGNATIONS)[number];
export type Department = (typeof DEPARTMENTS)[number];

export type User = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  designation: string | null;
  department: string | null;
  /** Codeteak badge id for managers/employees, e.g. CDTK001. Null for admins. */
  companyId: string | null;
  role: Role;
  status: UserStatus;
  managerId: string | null;
  headedDepartments: Department[];
  extraDesignations: Designation[];
  lastSeenAt: string | null;
  createdAt: string;
};

export type PublicUser = Omit<User, never>;

export type SessionUser = Pick<
  User,
  | 'id'
  | 'name'
  | 'email'
  | 'avatar'
  | 'designation'
  | 'department'
  | 'companyId'
  | 'role'
  | 'status'
  | 'headedDepartments'
  | 'extraDesignations'
>;

const COMPANY_ID_PREFIX = 'CDTK';

export function formatCompanyId(sequence: number) {
  return `${COMPANY_ID_PREFIX}${String(sequence).padStart(3, '0')}`;
}

export function parseCompanyIdSequence(
  companyId: string | null | undefined,
): number | null {
  if (!companyId) return null;
  const match = /^CDTK(\d+)$/i.exec(companyId.trim());
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}
