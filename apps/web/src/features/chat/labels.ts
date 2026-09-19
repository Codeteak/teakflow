import type { Conversation } from '@teakflow/shared';
import { CONVERSATION_TYPE } from '@teakflow/shared';

export function conversationTitle(conversation: Conversation, viewerId: string) {
  if (conversation.type === CONVERSATION_TYPE.CHANNEL) {
    return `#${conversation.name}`;
  }
  if (conversation.type === CONVERSATION_TYPE.GROUP) {
    return conversation.name ?? 'Group';
  }
  return (
    conversation.members.find((member) => member.userId !== viewerId)?.user.name ??
    'Direct message'
  );
}

export function conversationPreview(conversation: Conversation) {
  if (!conversation.lastMessage) {
    return 'No messages yet';
  }
  if (conversation.type === CONVERSATION_TYPE.DIRECT) {
    return conversation.lastMessage.content;
  }
  return `${conversation.lastMessage.senderName}: ${conversation.lastMessage.content}`;
}
