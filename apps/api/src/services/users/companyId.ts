import { Op } from 'sequelize';
import { ROLES, formatCompanyId, parseCompanyIdSequence } from '@teakflow/shared';
import type { Role } from '@teakflow/shared';
import { User } from '../../models/user';

/** Next Codeteak badge id (CDTK001…). Admins never receive one. */
export async function nextCompanyId(): Promise<string> {
  const rows = await User.findAll({
    attributes: ['companyId'],
    where: { companyId: { [Op.ne]: null } },
  });
  let max = 0;
  for (const row of rows) {
    const sequence = parseCompanyIdSequence(row.companyId);
    if (sequence !== null && sequence > max) {
      max = sequence;
    }
  }
  return formatCompanyId(max + 1);
}

export function roleNeedsCompanyId(role: Role) {
  return role !== ROLES.ADMIN;
}

/** Assign missing CDTK ids to managers/employees; clear any id on admins. */
export async function ensureCompanyIds() {
  const admins = await User.findAll({
    where: { role: ROLES.ADMIN, companyId: { [Op.ne]: null } },
  });
  for (const admin of admins) {
    admin.companyId = null;
    await admin.save();
  }

  const missing = await User.findAll({
    where: {
      role: { [Op.ne]: ROLES.ADMIN },
      companyId: null,
    },
    order: [
      ['createdAt', 'ASC'],
      ['email', 'ASC'],
    ],
  });

  for (const user of missing) {
    user.companyId = await nextCompanyId();
    await user.save();
  }
}
