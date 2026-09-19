import { collectionPeriod } from '@teakflow/shared';
import { apiRequest } from '@/services/api/client';
import type {
  SalesDashboard,
  SalesDayReport,
  SalesPaymentsView,
  SalesShop,
} from '@teakflow/shared';

export function getSalesDayRequest() {
  return apiRequest<{
    workDate: string;
    report: SalesDayReport | null;
    visits: {
      id: string;
      shopId: string | null;
      shopName: string;
      place: string;
      listed: boolean;
      kind: string;
      count: number;
      notes: string;
    }[];
    received: {
      id: string;
      shopId: string | null;
      shopName: string;
      amount: number;
      gst: string;
      ref: string;
      mode: string;
      bankName: string;
    }[];
    shops: SalesShop[];
  }>('/sales/day');
}

export function saveSalesDayRequest(body: unknown) {
  return apiRequest<Awaited<ReturnType<typeof getSalesDayRequest>>>('/sales/day', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function getSalesDashboardRequest(
  from?: string,
  to?: string,
  salesmanId?: string,
) {
  const q = new URLSearchParams();
  if (from) q.set('from', from);
  if (to) q.set('to', to);
  if (salesmanId) q.set('salesmanId', salesmanId);
  const qs = q.toString();
  return apiRequest<SalesDashboard>(`/sales/dashboard${qs ? `?${qs}` : ''}`);
}

export function getSalesPaymentsRequest(month?: string, year?: number, refresh = false) {
  const q = new URLSearchParams();
  if (month) q.set('month', month);
  if (year) q.set('year', String(year));
  if (refresh) q.set('refresh', '1');
  const qs = q.toString();
  return apiRequest<SalesPaymentsView>(`/sales/payments${qs ? `?${qs}` : ''}`);
}

export function patchSalesPaymentRequest(body: unknown) {
  return apiRequest<SalesPaymentsView>('/sales/payments', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function upsertShopsRequest(body: {
  shops?: { shopId: string; name: string; place?: string }[];
  csv?: string;
  confirm?: boolean;
}) {
  return apiRequest<{
    created: number;
    updated: number;
    shops: SalesShop[];
    errors?: string[];
    confirm?: boolean;
  }>('/sales/shops', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateShopRequest(
  shopId: string,
  body: { name: string; place?: string },
) {
  return apiRequest<{ shops: SalesShop[] }>(
    `/sales/shops/${encodeURIComponent(shopId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
  );
}

export function deleteShopRequest(shopId: string) {
  return apiRequest<{ shops: SalesShop[] }>(
    `/sales/shops/${encodeURIComponent(shopId)}`,
    { method: 'DELETE' },
  );
}

export async function fetchShopTemplateCsv() {
  const response = await fetch('/api/v1/sales/shops/template.csv', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Unable to load the example sheet.');
  }
  return response.text();
}

export async function fetchSalesCsv(
  kind: 'export' | 'summary',
  filters?: { from?: string; to?: string; salesmanId?: string },
) {
  const q = new URLSearchParams();
  if (filters?.from) q.set('from', filters.from);
  if (filters?.to) q.set('to', filters.to);
  if (filters?.salesmanId) q.set('salesmanId', filters.salesmanId);
  const path = kind === 'export' ? '/sales/export.csv' : '/sales/summary.csv';
  const qs = q.toString();
  const response = await fetch(`/api/v1${path}${qs ? `?${qs}` : ''}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Unable to load CSV.');
  }
  return response.text();
}

export function salesCsvFilename(kind: 'export' | 'summary') {
  return kind === 'export' ? 'sales-daily.csv' : 'shop-summary.csv';
}

export function defaultCollectionHint() {
  const period = collectionPeriod(new Date(), 'Asia/Kolkata');
  return period;
}
