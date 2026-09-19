import type { CreateUserInput, PublicUser, UpdateUserInput } from '@teakflow/shared';
import { apiRequest } from '@/services/api/client';

export function listUsersRequest() {
  return apiRequest<PublicUser[]>('/users');
}

export function createUserRequest(input: CreateUserInput) {
  return apiRequest<PublicUser>('/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateUserRequest(id: string, input: UpdateUserInput) {
  return apiRequest<PublicUser>(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
