import { Check, CheckCheck, Clock } from 'lucide-react';
import type { ConversationMemberView, Message } from '@teakflow/shared';
import { cn } from '@/lib/cn';

export type MessageReceipt = 'pending' | 'sent' | 'delivered' | 'read';

export function messageReceiptStatus(
  message: Message,
  messages: Message[],
  members: ConversationMemberView[],
  viewerId: string,
): MessageReceipt | null {
  if (message.senderId !== viewerId) {
    return null;
  }
  if (message.id.startsWith('temp-')) {
    return 'pending';
  }

  const others = members.filter((member) => member.userId !== viewerId);
  if (others.length === 0) {
    return 'delivered';
  }

  const messageIndex = messages.findIndex((row) => row.id === message.id);
  if (messageIndex < 0) {
    return 'sent';
  }

  const readByAll = others.every((member) => {
    if (!member.lastReadMessageId) {
      return false;
    }
    const readIndex = messages.findIndex((row) => row.id === member.lastReadMessageId);
    if (readIndex < 0) {
      return member.lastReadMessageId === message.id;
    }
    return readIndex >= messageIndex;
  });

  if (readByAll) {
    return 'read';
  }

  return 'delivered';
}

export function MessageReceiptTicks({
  status,
  inverted,
  className,
}: {
  status: MessageReceipt;
  inverted?: boolean;
  className?: string;
}) {
  const label =
    status === 'pending'
      ? 'Sending'
      : status === 'sent'
        ? 'Sent'
        : status === 'delivered'
          ? 'Delivered'
          : 'Read';

  return (
    <span
      className={cn('inline-flex items-center', className)}
      title={label}
      aria-label={label}
    >
      {status === 'pending' ? (
        <Clock
          size={12}
          strokeWidth={2}
          className={inverted ? 'text-surface/80' : 'text-muted'}
        />
      ) : null}
      {status === 'sent' ? (
        <Check
          size={14}
          strokeWidth={2.25}
          className={inverted ? 'text-surface/85' : 'text-muted'}
        />
      ) : null}
      {status === 'delivered' ? (
        <CheckCheck
          size={14}
          strokeWidth={2.25}
          className={inverted ? 'text-surface/85' : 'text-muted'}
        />
      ) : null}
      {status === 'read' ? (
        <CheckCheck size={14} strokeWidth={2.25} className="text-[#34B7F1]" />
      ) : null}
    </span>
  );
}
