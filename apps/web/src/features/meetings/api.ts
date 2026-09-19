import type { CreateMeetingInput, Meeting } from '@teakflow/shared';
import { apiRequest } from '@/services/api/client';

export function listMeetingsRequest() {
  return apiRequest<Meeting[]>('/meetings');
}

export function createMeetingRequest(input: CreateMeetingInput) {
  return apiRequest<Meeting>('/meetings', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function joinMeetingRequest(id: string) {
  return apiRequest<{ googleMeetUrl: string }>(`/meetings/${id}/join`, {
    method: 'POST',
  });
}

export function disconnectGoogleRequest() {
  return apiRequest<{ ok: true }>('/auth/google', {
    method: 'DELETE',
  });
}
