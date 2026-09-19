import { AUDIT_ACTION } from '@teakflow/shared';
import { AuditLog } from '../../models/auditLog';
import { User } from '../../models/user';

export type AuditLogRow = {
  id: string;
  userId: string;
  userName: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export async function writeAudit(input: {
  userId: string;
  action: (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION] | string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  await AuditLog.create({
    userId: input.userId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: input.metadata ?? null,
  });
}

export async function listAuditLogs(limit = 80): Promise<AuditLogRow[]> {
  const rows = await AuditLog.findAll({
    order: [['createdAt', 'DESC']],
    limit: Math.min(Math.max(limit, 1), 200),
  });

  const userIds = [...new Set(rows.map((row) => row.userId))];
  const users = userIds.length
    ? await User.findAll({ where: { id: userIds }, attributes: ['id', 'name'] })
    : [];
  const names = new Map(users.map((user) => [user.id, user.name]));

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    userName: names.get(row.userId) ?? null,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
  }));
}
