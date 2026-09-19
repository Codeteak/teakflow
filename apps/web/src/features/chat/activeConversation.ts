import { NOTIFICATION_TYPE, type AppNotification, type NotificationType } from '@teakflow/shared';
import { useChatUnreadStore } from '@/store/chatUnread';

const CHAT_ALERT_TYPES = new Set<NotificationType>([
  NOTIFICATION_TYPE.MESSAGE,
  NOTIFICATION_TYPE.MENTION,
  NOTIFICATION_TYPE.REACTION,
]);

/** True when the signed-in user already has this conversation open. */
export function isViewingConversation(conversationId: string | null | undefined) {
  if (!conversationId) {
    return false;
  }
  return useChatUnreadStore.getState().openId === conversationId;
}

/** Chat alerts for the open thread should not ding or bump the bell. */
export function shouldSuppressChatAlert(notification: AppNotification) {
  if (!CHAT_ALERT_TYPES.has(notification.type)) {
    return false;
  }
  return isViewingConversation(notification.referenceId);
}
