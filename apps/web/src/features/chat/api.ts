import type {
  AppNotification,
  Conversation,
  ConversationList,
  CreateConversationInput,
  Message,
  MessageSearchResult,
  StoredFile,
  LinkPreview,
} from '@teakflow/shared';
import { apiRequest } from '@/services/api/client';

export function listConversationsRequest() {
  return apiRequest<ConversationList>('/conversations');
}

export function listManagedChannelsRequest() {
  return apiRequest<Conversation[]>('/conversations/managed-channels');
}

export function listUnreadTotalRequest() {
  return apiRequest<{ unreadTotal: number }>('/conversations/unread-total');
}

export function getConversationRequest(id: string) {
  return apiRequest<Conversation>(`/conversations/${id}`);
}

export function createConversationRequest(input: CreateConversationInput) {
  return apiRequest<Conversation>('/conversations', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteChannelRequest(id: string) {
  return apiRequest<{ ok: boolean }>(`/conversations/${id}`, { method: 'DELETE' });
}

export function listMessagesRequest(conversationId: string, thread?: string) {
  const query = thread ? `?thread=${encodeURIComponent(thread)}` : '';
  return apiRequest<Message[]>(`/conversations/${conversationId}/messages${query}`);
}

export function sendMessageRequest(
  conversationId: string,
  content: string,
  replyToMessageId?: string | null,
  attachments?: StoredFile[],
  linkPreviews?: LinkPreview[],
) {
  return apiRequest<Message>(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      content,
      replyToMessageId: replyToMessageId ?? null,
      attachments: attachments ?? [],
      linkPreviews: linkPreviews ?? [],
    }),
  });
}

export function editMessageRequest(id: string, content: string) {
  return apiRequest<Message>(`/messages/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });
}

export function deleteMessageRequest(id: string) {
  return apiRequest<Message>(`/messages/${id}`, { method: 'DELETE' });
}

export function addReactionRequest(id: string, reaction: string) {
  return apiRequest<Message>(`/messages/${id}/reactions`, {
    method: 'POST',
    body: JSON.stringify({ reaction }),
  });
}

export function removeReactionRequest(id: string, reaction: string) {
  return apiRequest<Message>(
    `/messages/${id}/reactions?reaction=${encodeURIComponent(reaction)}`,
    { method: 'DELETE' },
  );
}

export function markReadRequest(id: string) {
  return apiRequest<{ ok: boolean }>(`/messages/${id}/read`, { method: 'POST' });
}

export function searchMessagesRequest(params: {
  q?: string;
  senderId?: string;
  conversationId?: string;
  from?: string;
  to?: string;
}) {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.senderId) query.set('senderId', params.senderId);
  if (params.conversationId) query.set('conversationId', params.conversationId);
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  return apiRequest<MessageSearchResult>(`/conversations/search?${query.toString()}`);
}

export function addMemberRequest(conversationId: string, userId: string) {
  return apiRequest<Conversation>(`/conversations/${conversationId}/members`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

export function listNotificationsRequest() {
  return apiRequest<AppNotification[]>('/notifications');
}

export function markNotificationReadRequest(id: string) {
  return apiRequest<AppNotification>(`/notifications/${id}/read`, { method: 'POST' });
}

export function markAllNotificationsReadRequest() {
  return apiRequest<{ ok: boolean }>('/notifications/read-all', { method: 'POST' });
}
