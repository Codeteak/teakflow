import type { SessionUser, StoredFile, LinkPreview } from '@teakflow/shared';
import { apiRequest } from '@/services/api/client';

export function uploadFileRequest(
  file: File,
  folder: 'avatars' | 'chat' | 'files' = 'files',
) {
  const body = new FormData();
  body.append('file', file);
  body.append('folder', folder);
  return apiRequest<StoredFile>('/files', {
    method: 'POST',
    body,
  });
}

export function uploadAvatarRequest(file: File) {
  const body = new FormData();
  body.append('file', file);
  return apiRequest<SessionUser>('/files/avatar', {
    method: 'POST',
    body,
  });
}

export function previewLinkRequest(url: string) {
  return apiRequest<LinkPreview | null>('/files/link-preview', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}
