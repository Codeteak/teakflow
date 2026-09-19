import type {
  DailyWorkAdminView,
  DailyWorkEntry,
  DailyWorkToday,
} from '@teakflow/shared';
import { apiRequest } from '@/services/api/client';

export function getTodayRequest() {
  return apiRequest<DailyWorkToday>('/daily-work/today');
}

export function submitTodayRequest(content: string) {
  return apiRequest<DailyWorkEntry>('/daily-work', {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export function updateTodayRequest(content: string) {
  return apiRequest<DailyWorkEntry>('/daily-work/today', {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });
}

export function getHistoryRequest() {
  return apiRequest<DailyWorkEntry[]>('/daily-work/history');
}

export function getEntryRequest(id: string) {
  return apiRequest<DailyWorkEntry>(`/daily-work/${id}`);
}

export function getAdminDailyWorkRequest(date?: string) {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return apiRequest<DailyWorkAdminView>(`/daily-work/admin${query}`);
}

export function getUserDailyWorkRequest(userId: string, date?: string) {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return apiRequest<DailyWorkEntry>(`/daily-work/user/${userId}${query}`);
}

export function getUserHistoryRequest(userId: string) {
  return apiRequest<DailyWorkEntry[]>(`/daily-work/user/${userId}/history`);
}
