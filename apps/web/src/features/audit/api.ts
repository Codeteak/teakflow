import { apiRequest } from '@/services/api/client';

export type AuditLogItem = {
  id: string;
  userId: string;
  userName: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export function listAuditLogsRequest(limit = 80) {
  return apiRequest<AuditLogItem[]>(`/audit-logs?limit=${limit}`);
}
