import { Op } from 'sequelize';
import { describe, expect, it, vi } from 'vitest';
import { ROLES, USER_STATUS } from '@teakflow/shared';
import { User } from '../../models/user';
import {
  assertCanInviteToMeeting,
  assertCanReadDailyWork,
  listTeamDailyWorkUsers,
  resolveManagerId,
  teamDailyWorkWhere,
  uniqueHeadedDepartments,
} from './scope';

vi.mock('../../models/user', () => ({
  User: {
    findByPk: vi.fn(),
    findAll: vi.fn(),
  },
}));

const managerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const leadId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const employeeId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const outsiderId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const treePeople = [
  { id: managerId, managerId: null },
  { id: leadId, managerId: managerId },
  { id: employeeId, managerId: leadId },
  { id: outsiderId, managerId: null },
];

function inIds(where: { id?: unknown }) {
  const raw = where.id;
  if (Array.isArray(raw)) {
    return raw as string[];
  }
  if (raw && typeof raw === 'object' && Op.in in (raw as object)) {
    return (raw as { [Op.in]: string[] })[Op.in] ?? [];
  }
  return [];
}

describe('teamDailyWorkWhere', () => {
  it('lists all active people for admin', async () => {
    await expect(teamDailyWorkWhere(managerId, ROLES.ADMIN)).resolves.toEqual({ status: USER_STATUS.ACTIVE });
  });

  it('limits managers to their reporting tree', async () => {
    vi.mocked(User.findAll).mockResolvedValue(treePeople as never);
    const where = await teamDailyWorkWhere(managerId, ROLES.MANAGER);
    const ids = inIds(where);
    expect(ids.sort()).toEqual([employeeId, leadId, managerId].sort());
    expect(ids).not.toContain(outsiderId);
  });

  it('limits leads to themselves and people under them, not the rest of the company', async () => {
    vi.mocked(User.findAll).mockResolvedValue(treePeople as never);
    const where = await teamDailyWorkWhere(leadId, ROLES.LEAD);
    const ids = inIds(where);
    expect(ids.sort()).toEqual([employeeId, leadId].sort());
    expect(ids).not.toContain(managerId);
    expect(ids).not.toContain(outsiderId);
  });
});

describe('listTeamDailyWorkUsers', () => {
  it('returns every active person for admin', async () => {
    vi.mocked(User.findAll).mockResolvedValue(treePeople as never);
    const rows = await listTeamDailyWorkUsers(managerId, ROLES.ADMIN);
    expect(rows).toHaveLength(4);
  });

  it('drops people outside a manager tree even if findAll returned the whole company', async () => {
    vi.mocked(User.findAll).mockResolvedValue(treePeople as never);
    const rows = await listTeamDailyWorkUsers(managerId, ROLES.MANAGER);
    expect(rows.map((row) => row.id).sort()).toEqual([employeeId, leadId, managerId].sort());
  });

  it('does not let a lead see their manager or a sibling team', async () => {
    vi.mocked(User.findAll).mockResolvedValue(treePeople as never);
    const rows = await listTeamDailyWorkUsers(leadId, ROLES.LEAD);
    expect(rows.map((row) => row.id).sort()).toEqual([employeeId, leadId].sort());
  });

  it('forbids employees from the team list', async () => {
    await expect(listTeamDailyWorkUsers(employeeId, ROLES.EMPLOYEE)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('assertCanReadDailyWork', () => {
  it('allows admin for anyone', async () => {
    await expect(assertCanReadDailyWork(managerId, ROLES.ADMIN, employeeId)).resolves.toBeUndefined();
  });

  it('allows a manager for a nested employee', async () => {
    vi.mocked(User.findAll).mockResolvedValue(treePeople as never);
    await expect(assertCanReadDailyWork(managerId, ROLES.MANAGER, employeeId)).resolves.toBeUndefined();
  });

  it('allows a lead for their employee', async () => {
    vi.mocked(User.findAll).mockResolvedValue(treePeople as never);
    await expect(assertCanReadDailyWork(leadId, ROLES.LEAD, employeeId)).resolves.toBeUndefined();
  });

  it('rejects a manager for someone outside the tree', async () => {
    vi.mocked(User.findAll).mockResolvedValue(treePeople as never);
    await expect(assertCanReadDailyWork(managerId, ROLES.MANAGER, outsiderId)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('assertCanInviteToMeeting', () => {
  it('lets a manager invite a nested report', async () => {
    vi.mocked(User.findAll).mockResolvedValue(treePeople as never);
    await expect(assertCanInviteToMeeting(managerId, ROLES.MANAGER, [employeeId])).resolves.toBeUndefined();
  });

  it('blocks a lead from inviting outside their people', async () => {
    vi.mocked(User.findAll).mockResolvedValue(treePeople as never);
    await expect(assertCanInviteToMeeting(leadId, ROLES.LEAD, [outsiderId])).rejects.toMatchObject({
      code: 'PARTICIPANT_OUT_OF_SCOPE',
    });
  });
});

describe('resolveManagerId', () => {
  it('clears manager for managers', async () => {
    await expect(resolveManagerId(managerId, ROLES.MANAGER)).resolves.toBeNull();
  });

  it('accepts a manager for a lead', async () => {
    vi.mocked(User.findByPk).mockResolvedValue({
      id: managerId,
      role: ROLES.MANAGER,
      status: USER_STATUS.ACTIVE,
    } as never);
    await expect(resolveManagerId(managerId, ROLES.LEAD)).resolves.toBe(managerId);
  });

  it('accepts a manager who heads the employee department', async () => {
    vi.mocked(User.findByPk).mockResolvedValue({
      id: managerId,
      role: ROLES.MANAGER,
      status: USER_STATUS.ACTIVE,
      department: 'Engineering',
      headedDepartments: ['Engineering', 'Sales'],
    } as never);
    await expect(resolveManagerId(managerId, ROLES.EMPLOYEE, undefined, 'Sales')).resolves.toBe(managerId);
  });

  it('rejects a manager who does not head that department', async () => {
    vi.mocked(User.findByPk).mockResolvedValue({
      id: managerId,
      role: ROLES.MANAGER,
      status: USER_STATUS.ACTIVE,
      department: 'Engineering',
      headedDepartments: ['Engineering'],
    } as never);
    await expect(resolveManagerId(managerId, ROLES.EMPLOYEE, undefined, 'Sales')).rejects.toMatchObject({
      code: 'INVALID_MANAGER',
    });
  });

  it('rejects reporting to yourself', async () => {
    await expect(resolveManagerId(leadId, ROLES.EMPLOYEE, leadId)).rejects.toMatchObject({
      code: 'INVALID_MANAGER',
    });
  });

  it('rejects a reporting cycle', async () => {
    vi.mocked(User.findByPk).mockImplementation(async (id: string) => {
      if (id === leadId) {
        return { id: leadId, role: ROLES.LEAD, status: USER_STATUS.ACTIVE, managerId: managerId } as never;
      }
      if (id === managerId) {
        return { id: managerId, role: ROLES.MANAGER, status: USER_STATUS.ACTIVE, managerId: null } as never;
      }
      return null;
    });
    await expect(resolveManagerId(leadId, ROLES.EMPLOYEE, managerId)).rejects.toMatchObject({
      code: 'INVALID_MANAGER',
    });
  });
});

describe('uniqueHeadedDepartments', () => {
  it('rejects a second manager for the same department', async () => {
    vi.mocked(User.findAll).mockResolvedValue([
      { id: managerId, name: 'Nisha', headedDepartments: ['Engineering', 'Sales'] },
    ] as never);
    await expect(uniqueHeadedDepartments(outsiderId, ['Engineering'])).rejects.toMatchObject({
      code: 'DEPARTMENT_HEADED',
    });
  });

  it('allows the same manager to keep their departments', async () => {
    vi.mocked(User.findAll).mockResolvedValue([
      { id: managerId, name: 'Nisha', headedDepartments: ['Engineering', 'Sales'] },
    ] as never);
    await expect(uniqueHeadedDepartments(managerId, ['Engineering', 'Sales'])).resolves.toEqual([
      'Engineering',
      'Sales',
    ]);
  });
});
