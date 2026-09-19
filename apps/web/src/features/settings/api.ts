import type { CompanySettings, UpdateDailyWorkWindowInput } from '@teakflow/shared';
import { apiRequest } from '@/services/api/client';

export function getSettingsRequest() {
  return apiRequest<CompanySettings>('/settings');
}

export function updateDailyWorkWindowRequest(input: UpdateDailyWorkWindowInput) {
  return apiRequest<CompanySettings>('/settings/daily-work', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
