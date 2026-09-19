import type {
  CONVERSATION_TYPE,
  CHANNEL_VISIBILITY,
  PRESENCE_STATUS,
} from '../constants/index';
import type { MeetingAttachment } from './app';
import type { LinkPreview, StoredFile } from './files';
import type { Department, PublicUser } from './user';

export type ConversationType = (typeof CONVERSATION_TYPE)[keyof typeof CONVERSATION_TYPE];
export type ChannelVisibility =
  (typeof CHANNEL_VISIBILITY)[keyof typeof CHANNEL_VISIBILITY];
export type PresenceStatus = (typeof PRESENCE_STATUS)[keyof typeof PRESENCE_STATUS];

export type ConversationMemberView = {
  id: string;
  userId: string;
  joinedAt: string;
  lastReadMessageId: string | null;
  user: PublicUser;
};

export type MessageReactionCount = {
  reaction: string;
  count: number;
  userIds: string[];
};

export type MessagePreview = {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
  attachments?: StoredFile[];
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  content: string;
  attachments: StoredFile[];
  meeting: MeetingAttachment | null;
  linkPreviews: LinkPreview[];
  replyToMessageId: string | null;
  replyTo: MessagePreview | null;
  replyCount: number;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  reactions: MessageReactionCount[];
};

export type Conversation = {
  id: string;
  type: ConversationType;
  name: string | null;
  visibility: ChannelVisibility | null;
  department: Department | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  unreadCount: number;
  lastMessage: MessagePreview | null;
  members: ConversationMemberView[];
  onlineUserIds?: string[];
};

export type ConversationMember = {
  id: string;
  conversationId: string;
  userId: string;
  joinedAt: string;
  lastReadMessageId: string | null;
};

export type MessageReaction = {
  id: string;
  messageId: string;
  userId: string;
  reaction: string;
  createdAt: string;
};

export type ConversationList = {
  items: Conversation[];
  unreadTotal: number;
};

export type MessageSearchHit = {
  message: Message;
  conversationId: string;
  conversationName: string;
};

export type MessageSearchResult = {
  items: MessageSearchHit[];
  people: PublicUser[];
  suggestions: string[];
  completions: string[];
  correctedQuery: string | null;
};
