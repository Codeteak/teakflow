import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorBanner, PageLoading } from '@/components/ui/page-state';
import { listAuditLogsRequest, type AuditLogItem } from '@/features/audit/api';

function labelAction(action: string) {
  return action
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function AuditLogsPage() {
  const [rows, setRows] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    listAuditLogsRequest()
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((cause) => {
        if (!cancelled)
          setError(cause instanceof Error ? cause.message : 'Unable to load audit logs.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Audit logs</h1>
        <p className="mt-1 text-sm text-muted">
          Company actions that matter for accountability.
        </p>
      </header>

      {loading ? <PageLoading rows={4} /> : null}
      {error ? <ErrorBanner message={error} /> : null}

      <Card className="overflow-hidden p-0">
        {rows.length === 0 && !loading ? (
          <EmptyState
            title="No audit events yet"
            description="Important company actions will appear here."
          />
        ) : (
          <div className="divide-y divide-line">
            {rows.map((row) => (
              <div key={row.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">{labelAction(row.action)}</p>
                  <p className="font-mono text-[11px] text-muted">
                    {new Intl.DateTimeFormat('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(row.createdAt))}
                  </p>
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {row.userName ?? 'Unknown'} · {row.entityType}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
