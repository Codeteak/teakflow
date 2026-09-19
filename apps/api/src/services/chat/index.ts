import { Op, QueryTypes, UniqueConstraintError } from 'sequelize';
import { sequelize } from '../../config/database';
import type {
  Conversation,
  ConversationList,
  CreateConversationInput,
  LinkPreview,
  MeetingAttachment,
  Message,
  MessagePreview,
  MessageSearchHit,
  MessageSearchResult,
  PublicUser,
  StoredFile,
} from '@teakflow/shared';
import {
  AUDIT_ACTION,
  CHANNEL_VISIBILITY,
  CONVERSATION_TYPE,
  DEFAULT_CHANNELS,
  NOTIFICATION_TYPE,
  ROLES,
  SOCKET_EVENTS,
  USER_STATUS,
  meetingAttachmentSchema,
  messageSnippet,
  storedFileSchema,
} from '@teakflow/shared';
import { Conversation as ConversationModel } from '../../models/conversation';
import { ConversationMember } from '../../models/conversationMember';
import { Message as MessageModel } from '../../models/message';
import { MessageReaction } from '../../models/messageReaction';
import { User } from '../../models/user';
import { AppError } from '../../middlewares/errorHandler/index';
import { writeAudit } from '../audit/index';
import { createNotification } from '../notifications/index';
import {
  broadcastMessage,
  emitToConversation,
  emitToUser,
  isUserOnline,
  onlineUserIds,
} from '../../sockets/bus';
import { mentionedUserIds } from './mentions';
import { previewsForText } from '../linkPreview';
import { indexMessageRow, removeMessageDocument, searchChatIndex } from '../search/index';
import { teamScopeUserIds } from '../users/scope';

const DELETED_COPY = 'This message was deleted.';

function asStoredFiles(value: unknown): StoredFile[] {
  let rows = value;
  if (typeof value === 'string') {
    try {
      rows = JSON.parse(value) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows.flatMap((item) => {
    const parsed = storedFileSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

function asMeeting(value: unknown): MeetingAttachment | null {
  let rows = value;
  if (typeof value === 'string') {
    try {
      rows = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  if (!Array.isArray(rows)) {
    return null;
  }
  for (const item of rows) {
    const parsed = meetingAttachmentSchema.safeParse(item);
    if (parsed.success) {
      return parsed.data;
    }
  }
  return null;
}

function asLinkPreviews(value: unknown): LinkPreview[] {
  let rows = value;
  if (typeof value === 'string') {
    try {
      rows = JSON.parse(value) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }
    const row = item as Record<string, unknown>;
    const url = typeof row.url === 'string' ? row.url : '';
    const title = typeof row.title === 'string' ? row.title : '';
    if (!url || !title) {
      return [];
    }
    try {
      return [
        {
          url,
          title,
          description: typeof row.description === 'string' ? row.description : '',
          image: typeof row.image === 'string' && row.image ? row.image : null,
          siteName:
            typeof row.siteName === 'string'
              ? row.siteName
              : typeof row.site_name === 'string'
                ? row.site_name
                : new URL(url).hostname,
        },
      ];
    } catch {
      return [];
    }
  });
}

function mergeLinkPreviews(
  primary: LinkPreview[],
  secondary: LinkPreview[],
): LinkPreview[] {
  const map = new Map<string, LinkPreview>();
  for (const row of [...secondary, ...primary]) {
    map.set(row.url, row);
  }
  return [...map.values()].slice(0, 3);
}

function requireDb() {
  if (!ConversationModel.sequelize) {
    throw new AppError(503, 'DATABASE_UNAVAILABLE', 'Database is not connected.');
  }
}

async function loadUser(userId: string) {
  const user = await User.findByPk(userId);
  if (!user || user.status !== USER_STATUS.ACTIVE) {
    throw new AppError(404, 'USER_NOT_FOUND', 'Employee not found.');
  }
  return user;
}

async function membership(conversationId: string, userId: string) {
  const row = await ConversationMember.findOne({ where: { conversationId, userId } });
  if (!row) {
    throw new AppError(403, 'NOT_A_MEMBER', 'You are not in this conversation.');
  }
  return row;
}

async function assertCanAccessConversation(conversationId: string, userId: string) {
  await membership(conversationId, userId);
}

function previewFromMessage(row: MessageModel, senderName: string): MessagePreview {
  const attachments = row.deletedAt ? [] : asStoredFiles(row.attachments);
  return {
    id: row.id,
    senderId: row.senderId,
    senderName,
    content: row.deletedAt
      ? DELETED_COPY
      : messageSnippet(row.content, attachments, asMeeting(row.attachments)),
    createdAt: row.createdAt.toISOString(),
    attachments,
  };
}

function groupReactions(rows: { reaction: string; userId: string }[]) {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const list = map.get(row.reaction) ?? [];
    list.push(row.userId);
    map.set(row.reaction, list);
  }
  return [...map.entries()].map(([reaction, userIds]) => ({
    reaction,
    count: userIds.length,
    userIds,
  }));
}

const messageInclude = [
  { model: User, as: 'sender', attributes: { exclude: ['passwordHash'] } },
  { model: MessageReaction, as: 'reactions', separate: true },
  {
    model: MessageModel,
    as: 'parent',
    required: false,
    include: [{ model: User, as: 'sender', attributes: { exclude: ['passwordHash'] } }],
  },
];

async function serializeMessages(rows: MessageModel[]): Promise<Message[]> {
  if (rows.length === 0) {
    return [];
  }
  const ids = rows.map((row) => row.id);
  const counts = sequelize
    ? await sequelize.query<{ reply_to_message_id: string; count: string }>(
        `SELECT reply_to_message_id, COUNT(*)::text AS count
         FROM messages
         WHERE reply_to_message_id IN (:ids)
         GROUP BY reply_to_message_id`,
        { replacements: { ids }, type: QueryTypes.SELECT },
      )
    : [];
  const countMap = new Map(
    counts.map((row) => [row.reply_to_message_id, Number(row.count)]),
  );

  return rows.map((row) => {
    const sender = row.get('sender') as User | undefined;
    const reactions = (row.get('reactions') as MessageReaction[] | undefined) ?? [];
    const parent = row.get('parent') as MessageModel | undefined;
    let replyTo: MessagePreview | null = null;
    if (parent) {
      const parentSender = parent.get('sender') as User | undefined;
      replyTo = previewFromMessage(parent, parentSender?.name ?? 'Employee');
    }
    return {
      id: row.id,
      conversationId: row.conversationId,
      senderId: row.senderId,
      senderName: sender?.name ?? 'Employee',
      senderAvatar: sender?.avatar ?? null,
      content: row.deletedAt ? DELETED_COPY : row.content,
      attachments: row.deletedAt ? [] : asStoredFiles(row.attachments),
      meeting: row.deletedAt ? null : asMeeting(row.attachments),
      linkPreviews: row.deletedAt ? [] : asLinkPreviews(row.linkPreviews),
      replyToMessageId: row.replyToMessageId,
      replyTo,
      replyCount: countMap.get(row.id) ?? 0,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      editedAt: row.editedAt?.toISOString() ?? null,
      deletedAt: row.deletedAt?.toISOString() ?? null,
      reactions: groupReactions(reactions),
    };
  });
}

async function serializeMessage(row: MessageModel): Promise<Message> {
  const loaded =
    row.get('sender') != null
      ? row
      : ((await MessageModel.findByPk(row.id, { include: messageInclude })) ?? row);
  const [payload] = await serializeMessages([loaded]);
  return payload!;
}

type LastMessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  attachments: unknown;
  created_at: Date;
  deleted_at: Date | null;
  sender_name: string | null;
};

type UnreadRow = {
  conversation_id: string;
  count: string;
};

async function hydrateConversations(
  rows: ConversationModel[],
  viewerId: string,
  mode: 'list' | 'detail',
): Promise<Conversation[]> {
  if (rows.length === 0 || !sequelize) {
    return [];
  }
  const ids = rows.map((row) => row.id);
  const memberScope =
    mode === 'list'
      ? rows.filter((row) => row.type === CONVERSATION_TYPE.DIRECT).map((row) => row.id)
      : ids;

  const [lastRows, unreadRows, memberships] = await Promise.all([
    sequelize.query<LastMessageRow>(
      `SELECT DISTINCT ON (m.conversation_id)
         m.id, m.conversation_id, m.sender_id, m.content, m.attachments, m.created_at, m.deleted_at, u.name AS sender_name
       FROM messages m
       LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id IN (:ids)
       ORDER BY m.conversation_id, m.created_at DESC`,
      { replacements: { ids }, type: QueryTypes.SELECT },
    ),
    sequelize.query<UnreadRow>(
      `SELECT m.conversation_id, COUNT(*)::text AS count
       FROM messages m
       INNER JOIN conversation_members cm
         ON cm.conversation_id = m.conversation_id AND cm.user_id = :userId
       LEFT JOIN messages lr ON lr.id = cm.last_read_message_id
       WHERE m.conversation_id IN (:ids)
         AND m.sender_id <> :userId
         AND m.deleted_at IS NULL
         AND (cm.last_read_message_id IS NULL OR m.created_at > lr.created_at)
       GROUP BY m.conversation_id`,
      { replacements: { ids, userId: viewerId }, type: QueryTypes.SELECT },
    ),
    memberScope.length === 0
      ? Promise.resolve([] as ConversationMember[])
      : ConversationMember.findAll({
          where: { conversationId: { [Op.in]: memberScope } },
          include: [
            { model: User, required: true, attributes: { exclude: ['passwordHash'] } },
          ],
        }),
  ]);

  const lastByConversation = new Map(lastRows.map((row) => [row.conversation_id, row]));
  const unreadByConversation = new Map(
    unreadRows.map((row) => [row.conversation_id, Number(row.count)]),
  );
  const membersByConversation = new Map<string, Conversation['members']>();
  for (const item of memberships) {
    const user = item.get('User') as User;
    const list = membersByConversation.get(item.conversationId) ?? [];
    list.push({
      id: item.id,
      userId: item.userId,
      joinedAt: item.joinedAt.toISOString(),
      lastReadMessageId: item.lastReadMessageId,
      user: user.toPublic(),
    });
    membersByConversation.set(item.conversationId, list);
  }
  for (const list of membersByConversation.values()) {
    list.sort((a, b) => a.user.name.localeCompare(b.user.name));
  }

  const online = onlineUserIds();
  return rows.map((row) => {
    const last = lastByConversation.get(row.id);
    const members = membersByConversation.get(row.id) ?? [];
    return {
      id: row.id,
      type: row.type,
      name: row.name,
      visibility: row.visibility,
      department: (row.department as Conversation['department']) ?? null,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      unreadCount: unreadByConversation.get(row.id) ?? 0,
      lastMessage: last
        ? {
            id: last.id,
            senderId: last.sender_id,
            senderName: last.sender_name ?? 'Employee',
            content: last.deleted_at
              ? DELETED_COPY
              : messageSnippet(
                  last.content,
                  asStoredFiles(last.attachments),
                  asMeeting(last.attachments),
                ),
            createdAt: new Date(last.created_at).toISOString(),
          }
        : null,
      members,
      onlineUserIds: online.filter((id) =>
        members.some((member) => member.userId === id),
      ),
    };
  });
}

async function serializeConversation(
  row: ConversationModel,
  viewerId: string,
): Promise<Conversation> {
  const [item] = await hydrateConversations([row], viewerId, 'detail');
  if (!item) {
    throw new AppError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
  }
  return item;
}

type ConversationListRow = {
  id: string;
  type: Conversation['type'];
  name: string | null;
  visibility: Conversation['visibility'];
  department: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  unread_count: string;
  last_id: string | null;
  last_sender_id: string | null;
  last_content: string | null;
  last_attachments: unknown;
  last_created_at: Date | null;
  last_deleted_at: Date | null;
  last_sender_name: string | null;
  members: Conversation['members'] | string;
};

function mapConversationRow(row: ConversationListRow, _viewerId: string): Conversation {
  const members =
    (typeof row.members === 'string' ? JSON.parse(row.members) : row.members) ?? [];
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    visibility: row.visibility,
    department: (row.department as Conversation['department']) ?? null,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    unreadCount: Number(row.unread_count),
    lastMessage:
      row.last_id && row.last_sender_id && row.last_created_at
        ? {
            id: row.last_id,
            senderId: row.last_sender_id,
            senderName: row.last_sender_name ?? 'Employee',
            content: row.last_deleted_at
              ? DELETED_COPY
              : messageSnippet(
                  row.last_content ?? '',
                  asStoredFiles(row.last_attachments),
                  asMeeting(row.last_attachments),
                ),
            createdAt: new Date(row.last_created_at).toISOString(),
          }
        : null,
    members,
    onlineUserIds: onlineUserIds().filter((id) =>
      members.some((member: Conversation['members'][number]) => member.userId === id),
    ),
  };
}

const conversationSelectSql = `
WITH mine AS (
  SELECT c.id AS conversation_id, cm.last_read_message_id
  FROM conversations c
  LEFT JOIN conversation_members cm
    ON cm.conversation_id = c.id AND cm.user_id = :userId
  WHERE :adminView = TRUE OR cm.user_id IS NOT NULL
),
last AS (
  SELECT DISTINCT ON (m.conversation_id)
    m.conversation_id, m.id, m.sender_id, m.content, m.attachments, m.created_at, m.deleted_at, u.name AS sender_name
  FROM messages m
  INNER JOIN mine ON mine.conversation_id = m.conversation_id
  LEFT JOIN users u ON u.id = m.sender_id
  ORDER BY m.conversation_id, m.created_at DESC
),
unread AS (
  SELECT m.conversation_id, COUNT(*)::int AS count
  FROM messages m
  INNER JOIN mine ON mine.conversation_id = m.conversation_id
  LEFT JOIN messages lr ON lr.id = mine.last_read_message_id
  WHERE m.sender_id <> :userId
    AND m.deleted_at IS NULL
    AND (mine.last_read_message_id IS NULL OR m.created_at > lr.created_at)
  GROUP BY m.conversation_id
),
member_rows AS (
  SELECT
    cm.conversation_id,
    json_agg(
      json_build_object(
        'id', cm.id,
        'userId', u.id,
        'joinedAt', cm.joined_at,
        'lastReadMessageId', cm.last_read_message_id,
        'user', json_build_object(
          'id', u.id,
          'name', u.name,
          'email', u.email,
          'avatar', u.avatar,
          'designation', u.designation,
          'department', u.department,
          'role', u.role,
          'status', u.status,
          'managerId', u.manager_id,
          'lastSeenAt', u.last_seen_at,
          'createdAt', u.created_at
        )
      )
      ORDER BY u.name
    ) AS members
  FROM conversation_members cm
  INNER JOIN users u ON u.id = cm.user_id
  INNER JOIN conversations c ON c.id = cm.conversation_id
  INNER JOIN mine ON mine.conversation_id = c.id
  WHERE (
      :includeAllMembers = TRUE
      OR c.type = 'DIRECT'
    )
    AND (:conversationId::uuid IS NULL OR c.id = :conversationId)
  GROUP BY cm.conversation_id
)
SELECT
  c.id, c.type, c.name, c.visibility, c.department, c.created_by, c.created_at, c.updated_at,
  COALESCE(unread.count, 0)::text AS unread_count,
  last.id AS last_id,
  last.sender_id AS last_sender_id,
  last.content AS last_content,
  last.attachments AS last_attachments,
  last.created_at AS last_created_at,
  last.deleted_at AS last_deleted_at,
  last.sender_name AS last_sender_name,
  COALESCE(member_rows.members, '[]'::json) AS members
FROM conversations c
INNER JOIN mine ON mine.conversation_id = c.id
LEFT JOIN last ON last.conversation_id = c.id
LEFT JOIN unread ON unread.conversation_id = c.id
LEFT JOIN member_rows ON member_rows.conversation_id = c.id
WHERE :conversationId::uuid IS NULL OR c.id = :conversationId
`;

async function addMembers(conversationId: string, userIds: string[]) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) {
    return;
  }
  await ConversationMember.bulkCreate(
    unique.map((userId) => ({ conversationId, userId, joinedAt: new Date() })),
    { ignoreDuplicates: true },
  );
}

async function activeUserIds(extra: Record<string, unknown> = {}) {
  const users = await User.findAll({
    where: { status: USER_STATUS.ACTIVE, ...extra },
    attributes: ['id'],
  });
  return users.map((user) => user.id);
}

async function audienceIdsForPublicRoom(
  creatorId: string,
  creatorRole: string,
  department?: string | null,
) {
  if (creatorRole === ROLES.ADMIN) {
    if (department) {
      return activeUserIds({ department });
    }
    return activeUserIds();
  }
  if (creatorRole === ROLES.MANAGER || creatorRole === ROLES.LEAD) {
    const ids = await teamScopeUserIds(creatorId, creatorRole);
    return ids ?? [creatorId];
  }
  return [creatorId];
}

export async function addUserToMatchingPublicRooms(user: User) {
  const rooms = await ConversationModel.findAll({
    where: {
      visibility: CHANNEL_VISIBILITY.PUBLIC,
      type: { [Op.in]: [CONVERSATION_TYPE.GROUP, CONVERSATION_TYPE.CHANNEL] },
    },
  });
  if (rooms.length === 0) {
    return;
  }
  const creators = await User.findAll({
    where: { id: { [Op.in]: [...new Set(rooms.map((room) => room.createdBy))] } },
    attributes: ['id', 'role'],
  });
  const roleById = new Map(creators.map((creator) => [creator.id, creator.role]));
  const treeByCreator = new Map<string, string[] | null>();
  for (const room of rooms) {
    const creatorRole = roleById.get(room.createdBy);
    if (creatorRole === ROLES.ADMIN) {
      if (room.department && user.department !== room.department) {
        continue;
      }
      await addMembers(room.id, [user.id]);
    } else if (creatorRole === ROLES.MANAGER || creatorRole === ROLES.LEAD) {
      if (!treeByCreator.has(room.createdBy)) {
        treeByCreator.set(
          room.createdBy,
          await teamScopeUserIds(room.createdBy, creatorRole),
        );
      }
      const tree = treeByCreator.get(room.createdBy);
      if (tree?.includes(user.id)) {
        await addMembers(room.id, [user.id]);
      }
    }
  }
}

export async function removeUserFromManagerPublicRooms(
  userId: string,
  managerId: string,
) {
  const rooms = await ConversationModel.findAll({
    where: {
      createdBy: managerId,
      visibility: CHANNEL_VISIBILITY.PUBLIC,
      type: { [Op.in]: [CONVERSATION_TYPE.GROUP, CONVERSATION_TYPE.CHANNEL] },
    },
    attributes: ['id'],
  });
  if (rooms.length === 0) {
    return;
  }
  await ConversationMember.destroy({
    where: { userId, conversationId: { [Op.in]: rooms.map((room) => room.id) } },
  });
}

export async function removeUserFromDepartmentPublicRooms(
  userId: string,
  department: string,
) {
  const rooms = await ConversationModel.findAll({
    where: {
      visibility: CHANNEL_VISIBILITY.PUBLIC,
      department,
      type: { [Op.in]: [CONVERSATION_TYPE.GROUP, CONVERSATION_TYPE.CHANNEL] },
    },
    attributes: ['id'],
  });
  if (rooms.length === 0) {
    return;
  }
  await ConversationMember.destroy({
    where: { userId, conversationId: { [Op.in]: rooms.map((room) => room.id) } },
  });
}

export async function syncPublicRoomAudiences() {
  const rooms = await ConversationModel.findAll({
    where: {
      visibility: CHANNEL_VISIBILITY.PUBLIC,
      type: { [Op.in]: [CONVERSATION_TYPE.GROUP, CONVERSATION_TYPE.CHANNEL] },
    },
  });
  if (rooms.length === 0) {
    return;
  }
  const creators = await User.findAll({
    where: { id: { [Op.in]: [...new Set(rooms.map((room) => room.createdBy))] } },
    attributes: ['id', 'role'],
  });
  const roleById = new Map(creators.map((creator) => [creator.id, creator.role]));
  for (const room of rooms) {
    const ids = await audienceIdsForPublicRoom(
      room.createdBy,
      roleById.get(room.createdBy) ?? ROLES.EMPLOYEE,
      room.department,
    );
    await addMembers(room.id, ids);
  }
}

export async function ensureDefaultChannels(createdBy: string) {
  requireDb();
  for (const slug of DEFAULT_CHANNELS) {
    const existing = await ConversationModel.findOne({
      where: { type: CONVERSATION_TYPE.CHANNEL, name: slug },
    });
    if (existing) {
      continue;
    }
    const channel = await ConversationModel.create({
      type: CONVERSATION_TYPE.CHANNEL,
      name: slug,
      visibility: CHANNEL_VISIBILITY.PUBLIC,
      department: null,
      createdBy,
    });
    await addMembers(
      channel.id,
      await audienceIdsForPublicRoom(createdBy, ROLES.ADMIN, null),
    );
  }
  await syncPublicRoomAudiences();
}

export async function addUserToPublicChannels(userId: string) {
  const user = await User.findByPk(userId);
  if (!user || user.status !== USER_STATUS.ACTIVE) {
    return;
  }
  await addUserToMatchingPublicRooms(user);
}

export async function listConversations(
  userId: string,
  _role: string,
): Promise<ConversationList> {
  requireDb();
  if (!sequelize) {
    return { items: [], unreadTotal: 0 };
  }
  const rows = await sequelize.query<ConversationListRow>(conversationSelectSql, {
    replacements: {
      userId,
      includeAllMembers: false,
      conversationId: null,
      adminView: false,
    },
    type: QueryTypes.SELECT,
  });
  const items = rows
    .map((row) => mapConversationRow(row, userId))
    .filter((item) => item.type !== CONVERSATION_TYPE.DIRECT || item.lastMessage !== null)
    .sort((a, b) => {
      const aTime = a.lastMessage?.createdAt ?? a.updatedAt;
      const bTime = b.lastMessage?.createdAt ?? b.updatedAt;
      return bTime.localeCompare(aTime);
    });
  return {
    items,
    unreadTotal: items.reduce((sum, item) => sum + item.unreadCount, 0),
  };
}

export async function listManagedChannels(
  userId: string,
  role: string,
): Promise<Conversation[]> {
  requireDb();
  if (role !== ROLES.ADMIN) {
    throw new AppError(403, 'FORBIDDEN', 'Only an admin can manage company channels.');
  }
  const rows = await ConversationModel.findAll({
    where: { type: CONVERSATION_TYPE.CHANNEL },
    order: [['name', 'ASC']],
  });
  return Promise.all(rows.map((row) => serializeConversation(row, userId)));
}

export async function getConversation(
  userId: string,
  conversationId: string,
  _role: string,
) {
  requireDb();
  if (!sequelize) {
    throw new AppError(503, 'DATABASE_UNAVAILABLE', 'Database is not connected.');
  }
  await assertCanAccessConversation(conversationId, userId);
  const rows = await sequelize.query<ConversationListRow>(conversationSelectSql, {
    replacements: {
      userId,
      includeAllMembers: true,
      conversationId,
      adminView: false,
    },
    type: QueryTypes.SELECT,
  });
  const item = rows[0] ? mapConversationRow(rows[0], userId) : null;
  if (!item) {
    throw new AppError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
  }
  return item;
}

export async function createConversation(
  actorId: string,
  actorRole: string,
  input: CreateConversationInput,
) {
  requireDb();
  if (input.type === CONVERSATION_TYPE.DIRECT) {
    if (input.userId === actorId) {
      throw new AppError(
        400,
        'INVALID_DM',
        'Choose another employee for a direct message.',
      );
    }
    await loadUser(input.userId);
    const mine = await ConversationMember.findAll({ where: { userId: actorId } });
    const theirs = await ConversationMember.findAll({ where: { userId: input.userId } });
    const shared = mine.filter((row) =>
      theirs.some((other) => other.conversationId === row.conversationId),
    );
    for (const item of shared) {
      const conversation = await ConversationModel.findByPk(item.conversationId);
      if (conversation?.type === CONVERSATION_TYPE.DIRECT) {
        return serializeConversation(conversation, actorId);
      }
    }
    const conversation = await ConversationModel.create({
      type: CONVERSATION_TYPE.DIRECT,
      name: null,
      visibility: null,
      createdBy: actorId,
    });
    await addMembers(conversation.id, [actorId, input.userId]);
    return serializeConversation(conversation, actorId);
  }

  if (input.type === CONVERSATION_TYPE.GROUP) {
    const visibility = input.visibility ?? CHANNEL_VISIBILITY.PRIVATE;
    if (visibility === CHANNEL_VISIBILITY.PUBLIC && actorRole === ROLES.EMPLOYEE) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Only an admin, manager, or lead can create a public group.',
      );
    }
    const department =
      actorRole === ROLES.ADMIN && visibility === CHANNEL_VISIBILITY.PUBLIC
        ? (input.department ?? null)
        : null;
    let memberIds: string[];
    if (visibility === CHANNEL_VISIBILITY.PUBLIC) {
      memberIds = await audienceIdsForPublicRoom(actorId, actorRole, department);
    } else {
      memberIds = [...new Set([actorId, ...(input.memberIds ?? [])])];
      await Promise.all(memberIds.map((id) => loadUser(id)));
    }
    const conversation = await ConversationModel.create({
      type: CONVERSATION_TYPE.GROUP,
      name: input.name,
      visibility,
      department,
      createdBy: actorId,
    });
    await addMembers(conversation.id, memberIds);
    return serializeConversation(conversation, actorId);
  }

  if (actorRole !== ROLES.ADMIN) {
    throw new AppError(403, 'FORBIDDEN', 'Only an admin can create company channels.');
  }
  const name = input.name.replace(/^#/, '').trim().toLowerCase();
  const existing = await ConversationModel.findOne({
    where: { type: CONVERSATION_TYPE.CHANNEL, name },
  });
  if (existing) {
    throw new AppError(409, 'CHANNEL_EXISTS', 'A channel with that name already exists.');
  }
  const conversation = await ConversationModel.create({
    type: CONVERSATION_TYPE.CHANNEL,
    name,
    visibility: input.visibility,
    department:
      input.visibility === CHANNEL_VISIBILITY.PUBLIC ? (input.department ?? null) : null,
    createdBy: actorId,
  });
  const memberIds =
    input.visibility === CHANNEL_VISIBILITY.PUBLIC
      ? await audienceIdsForPublicRoom(actorId, actorRole, input.department ?? null)
      : [...new Set([actorId, ...(input.memberIds ?? [])])];
  await addMembers(conversation.id, memberIds);
  await writeAudit({
    userId: actorId,
    action: AUDIT_ACTION.CHANNEL_CREATED,
    entityType: 'conversation',
    entityId: conversation.id,
    metadata: { name, visibility: input.visibility },
  });
  return serializeConversation(conversation, actorId);
}

export async function deleteChannel(
  _actorId: string,
  actorRole: string,
  conversationId: string,
) {
  requireDb();
  if (actorRole !== ROLES.ADMIN) {
    throw new AppError(403, 'FORBIDDEN', 'Only an admin can delete company channels.');
  }
  const conversation = await ConversationModel.findByPk(conversationId);
  if (!conversation || conversation.type !== CONVERSATION_TYPE.CHANNEL) {
    throw new AppError(404, 'CHANNEL_NOT_FOUND', 'Channel not found.');
  }
  if ((DEFAULT_CHANNELS as readonly string[]).includes(conversation.name ?? '')) {
    throw new AppError(409, 'DEFAULT_CHANNEL', 'Default channels cannot be deleted.');
  }
  const messageIds = (
    await MessageModel.findAll({ where: { conversationId }, attributes: ['id'] })
  ).map((row) => row.id);
  if (messageIds.length > 0) {
    await MessageReaction.destroy({ where: { messageId: { [Op.in]: messageIds } } });
  }
  await MessageModel.destroy({ where: { conversationId } });
  await ConversationMember.destroy({ where: { conversationId } });
  await conversation.destroy();
  return { ok: true };
}

export async function addConversationMember(
  actorId: string,
  actorRole: string,
  conversationId: string,
  userId: string,
) {
  requireDb();
  const conversation = await ConversationModel.findByPk(conversationId);
  if (!conversation) {
    throw new AppError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
  }
  const canManage =
    actorRole === ROLES.ADMIN ||
    (conversation.type === CONVERSATION_TYPE.GROUP && conversation.createdBy === actorId);
  if (!canManage) {
    throw new AppError(403, 'FORBIDDEN', 'You cannot add members to this conversation.');
  }
  await loadUser(userId);
  await addMembers(conversationId, [userId]);
  return getConversation(actorId, conversationId, actorRole);
}

export async function removeConversationMember(
  actorId: string,
  actorRole: string,
  conversationId: string,
  userId: string,
) {
  requireDb();
  const conversation = await ConversationModel.findByPk(conversationId);
  if (!conversation) {
    throw new AppError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
  }
  if (conversation.type === CONVERSATION_TYPE.DIRECT) {
    throw new AppError(409, 'DIRECT_LOCKED', 'Direct conversations keep both members.');
  }
  const canManage =
    actorRole === ROLES.ADMIN || conversation.createdBy === actorId || actorId === userId;
  if (!canManage) {
    throw new AppError(403, 'FORBIDDEN', 'You cannot remove that member.');
  }
  await ConversationMember.destroy({ where: { conversationId, userId } });
  return getConversation(actorId, conversationId, actorRole);
}

export async function listMessages(
  userId: string,
  conversationId: string,
  threadId?: string,
  _role: string = ROLES.EMPLOYEE,
) {
  requireDb();
  if (!sequelize) {
    return [];
  }
  await assertCanAccessConversation(conversationId, userId);
  const rows = await sequelize.query<{
    member_id: string | null;
    id: string | null;
    conversation_id: string;
    sender_id: string;
    sender_name: string | null;
    sender_avatar: string | null;
    content: string;
    attachments: unknown;
    link_previews: unknown;
    reply_to_message_id: string | null;
    created_at: Date;
    updated_at: Date;
    edited_at: Date | null;
    deleted_at: Date | null;
    reply_count: string;
    parent_id: string | null;
    parent_content: string | null;
    parent_attachments: unknown;
    parent_sender_id: string | null;
    parent_sender_name: string | null;
    parent_created_at: Date | null;
    parent_deleted_at: Date | null;
    reactions: { reaction: string; userId: string }[] | string;
  }>(
    `SELECT
        m.id, m.conversation_id, m.sender_id, m.content, m.attachments, m.link_previews, m.reply_to_message_id,
        m.created_at, m.updated_at, m.edited_at, m.deleted_at,
        s.name AS sender_name, s.avatar AS sender_avatar,
        (SELECT COUNT(*)::text FROM messages r WHERE r.reply_to_message_id = m.id) AS reply_count,
        p.id AS parent_id, p.content AS parent_content, p.attachments AS parent_attachments, p.sender_id AS parent_sender_id,
        p.created_at AS parent_created_at, p.deleted_at AS parent_deleted_at,
        ps.name AS parent_sender_name,
        COALESCE((
          SELECT json_agg(json_build_object('reaction', mr.reaction, 'userId', mr.user_id))
          FROM message_reactions mr
          WHERE mr.message_id = m.id
        ), '[]'::json) AS reactions
     FROM messages m
     LEFT JOIN users s ON s.id = m.sender_id
     LEFT JOIN messages p ON p.id = m.reply_to_message_id
     LEFT JOIN users ps ON ps.id = p.sender_id
     WHERE m.conversation_id = :conversationId
       AND (
         :threadId::uuid IS NULL
         OR m.id = :threadId
         OR m.reply_to_message_id = :threadId
       )
     ORDER BY m.created_at DESC
     LIMIT 80`,
    {
      replacements: { conversationId, threadId: threadId ?? null },
      type: QueryTypes.SELECT,
    },
  );

  return rows
    .reverse()
    .filter((row) => row.id)
    .map((row) => {
      const reactionRows =
        typeof row.reactions === 'string' ? JSON.parse(row.reactions) : row.reactions;
      return {
        id: row.id!,
        conversationId: row.conversation_id,
        senderId: row.sender_id,
        senderName: row.sender_name ?? 'Employee',
        senderAvatar: row.sender_avatar,
        content: row.deleted_at ? DELETED_COPY : row.content,
        attachments: row.deleted_at ? [] : asStoredFiles(row.attachments),
        meeting: row.deleted_at ? null : asMeeting(row.attachments),
        linkPreviews: row.deleted_at ? [] : asLinkPreviews(row.link_previews),
        replyToMessageId: row.reply_to_message_id,
        replyTo:
          row.parent_id && row.parent_sender_id && row.parent_created_at
            ? {
                id: row.parent_id,
                senderId: row.parent_sender_id,
                senderName: row.parent_sender_name ?? 'Employee',
                content: row.parent_deleted_at
                  ? DELETED_COPY
                  : messageSnippet(
                      row.parent_content ?? '',
                      asStoredFiles(row.parent_attachments),
                      asMeeting(row.parent_attachments),
                    ),
                createdAt: new Date(row.parent_created_at).toISOString(),
                attachments: row.parent_deleted_at
                  ? []
                  : asStoredFiles(row.parent_attachments),
              }
            : null,
        replyCount: Number(row.reply_count),
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
        editedAt: row.edited_at ? new Date(row.edited_at).toISOString() : null,
        deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
        reactions: groupReactions(reactionRows ?? []),
      };
    });
}

export async function createMessage(
  userId: string,
  conversationId: string,
  content: string,
  replyToMessageId?: string | null,
  options?: {
    skipMembership?: boolean;
    senderName?: string;
    senderAvatar?: string | null;
    attachments?: StoredFile[];
    meeting?: MeetingAttachment;
    linkPreviews?: LinkPreview[];
  },
) {
  requireDb();
  if (!options?.skipMembership) {
    await membership(conversationId, userId);
  }
  const attachments = asStoredFiles(options?.attachments ?? []);
  const meeting = options?.meeting ?? null;
  const storedAttachments = meeting ? [...attachments, meeting] : attachments;
  const text = content.trim();
  if (!text && storedAttachments.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Write a message or attach a file.');
  }
  if (replyToMessageId) {
    const parent = await MessageModel.findOne({
      where: { id: replyToMessageId, conversationId },
    });
    if (!parent) {
      throw new AppError(
        404,
        'PARENT_NOT_FOUND',
        'The message you are replying to was not found.',
      );
    }
  }
  const senderName = options?.senderName;
  const senderAvatar = options?.senderAvatar ?? null;
  const sender =
    senderName === undefined
      ? await User.findByPk(userId, { attributes: { exclude: ['passwordHash'] } })
      : null;
  const fetched = await previewsForText(
    text,
    attachments.map((file) => file.url),
  );
  const linkPreviews = mergeLinkPreviews(
    asLinkPreviews(options?.linkPreviews ?? []),
    fetched,
  );
  const row = await MessageModel.create({
    conversationId,
    senderId: userId,
    content: text,
    attachments: storedAttachments,
    linkPreviews,
    replyToMessageId: replyToMessageId ?? null,
  });
  const [memberRows, parent] = await Promise.all([
    ConversationMember.findAll({
      where: { conversationId },
      attributes: ['userId'],
    }),
    replyToMessageId
      ? MessageModel.findByPk(replyToMessageId, {
          include: [{ model: User, as: 'sender', attributes: ['name'] }],
        })
      : Promise.resolve(null),
  ]);
  const parentSender = parent?.get('sender') as User | undefined;
  const payload: Message = {
    id: row.id,
    conversationId,
    senderId: userId,
    senderName: senderName ?? sender?.name ?? 'Employee',
    senderAvatar: senderAvatar ?? sender?.avatar ?? null,
    content: text,
    attachments,
    meeting,
    linkPreviews,
    replyToMessageId: replyToMessageId ?? null,
    replyTo: parent ? previewFromMessage(parent, parentSender?.name ?? 'Employee') : null,
    replyCount: 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    editedAt: null,
    deletedAt: null,
    reactions: [],
  };

  const memberIds = [...new Set(memberRows.map((item) => item.userId))];
  broadcastMessage(memberIds, payload, userId);
  void notifyNewMessage(
    userId,
    conversationId,
    text || messageSnippet('', attachments, meeting),
    senderName ?? sender?.name ?? 'Employee',
    memberIds,
  ).catch(() => undefined);

  void ConversationModel.update(
    { updatedAt: new Date() },
    { where: { id: conversationId } },
  );
  void indexMessageRow(row).catch(() => undefined);
  return payload;
}

async function notifyNewMessage(
  userId: string,
  conversationId: string,
  content: string,
  senderName: string,
  memberIds: string[],
) {
  const conversation = await ConversationModel.findByPk(conversationId);
  const members = await User.findAll({
    where: { id: { [Op.in]: memberIds } },
    attributes: [
      'id',
      'name',
      'email',
      'avatar',
      'designation',
      'department',
      'role',
      'status',
      'lastSeenAt',
      'createdAt',
    ],
  });
  const publicMembers = members.map((user) => user.toPublic());
  const mentions = mentionedUserIds(content, publicMembers).filter((id) => id !== userId);
  await Promise.all(
    mentions.map((mentionedId) =>
      createNotification({
        userId: mentionedId,
        type: NOTIFICATION_TYPE.MENTION,
        title: senderName,
        message: `mentioned you in ${conversationLabel(conversation, publicMembers, mentionedId)}`,
        referenceId: conversationId,
      }),
    ),
  );
  if (conversation?.type === CONVERSATION_TYPE.DIRECT) {
    const other = publicMembers.find((member) => member.id !== userId);
    if (other && !mentions.includes(other.id)) {
      await createNotification({
        userId: other.id,
        type: NOTIFICATION_TYPE.MESSAGE,
        title: senderName,
        message: content.slice(0, 120),
        referenceId: conversationId,
      });
    }
  }
}

export async function updateMessage(userId: string, messageId: string, content: string) {
  requireDb();
  const row = await MessageModel.findByPk(messageId);
  if (!row) {
    throw new AppError(404, 'MESSAGE_NOT_FOUND', 'Message not found.');
  }
  await membership(row.conversationId, userId);
  if (row.senderId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'You can only edit your own messages.');
  }
  if (row.deletedAt) {
    throw new AppError(409, 'MESSAGE_DELETED', 'Deleted messages cannot be edited.');
  }
  row.content = content;
  row.editedAt = new Date();
  await row.save();
  const payload = await serializeMessage(row);
  emitToConversation(row.conversationId, SOCKET_EVENTS.MESSAGE_UPDATE, payload);
  void indexMessageRow(row).catch(() => undefined);
  return payload;
}

export async function deleteMessage(userId: string, messageId: string) {
  requireDb();
  const row = await MessageModel.findByPk(messageId);
  if (!row) {
    throw new AppError(404, 'MESSAGE_NOT_FOUND', 'Message not found.');
  }
  await membership(row.conversationId, userId);
  if (row.senderId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'You can only delete your own messages.');
  }
  row.deletedAt = new Date();
  await row.save();
  await writeAudit({
    userId,
    action: AUDIT_ACTION.MESSAGE_DELETED,
    entityType: 'message',
    entityId: row.id,
    metadata: { conversationId: row.conversationId },
  });
  const payload = await serializeMessage(row);
  emitToConversation(row.conversationId, SOCKET_EVENTS.MESSAGE_DELETE, payload);
  void removeMessageDocument(row.id).catch(() => undefined);
  return payload;
}

export async function addReaction(userId: string, messageId: string, reaction: string) {
  requireDb();
  const row = await MessageModel.findByPk(messageId);
  if (!row || row.deletedAt) {
    throw new AppError(404, 'MESSAGE_NOT_FOUND', 'Message not found.');
  }
  await membership(row.conversationId, userId);
  let created = true;
  try {
    await MessageReaction.create({ messageId, userId, reaction });
  } catch (error) {
    if (!(error instanceof UniqueConstraintError)) {
      throw error;
    }
    created = false;
  }
  const payload = await serializeReactionUpdate(row);
  emitToConversation(row.conversationId, SOCKET_EVENTS.MESSAGE_REACTION, payload);
  if (created && row.senderId !== userId) {
    try {
      const actor = await User.findByPk(userId, { attributes: ['name'] });
      await createNotification({
        userId: row.senderId,
        type: NOTIFICATION_TYPE.REACTION,
        title: actor?.name ?? 'Someone',
        message: `reacted ${reaction} to your message`,
        referenceId: row.conversationId,
      });
    } catch {
      // Reaction still succeeds if the notification cannot be stored or emitted.
    }
  }
  return payload;
}

export async function removeReaction(
  userId: string,
  messageId: string,
  reaction: string,
) {
  requireDb();
  const row = await MessageModel.findByPk(messageId);
  if (!row) {
    throw new AppError(404, 'MESSAGE_NOT_FOUND', 'Message not found.');
  }
  await membership(row.conversationId, userId);
  await MessageReaction.destroy({ where: { messageId, userId, reaction } });
  const payload = await serializeReactionUpdate(row);
  emitToConversation(row.conversationId, SOCKET_EVENTS.MESSAGE_REACTION, payload);
  return payload;
}

async function serializeReactionUpdate(row: MessageModel): Promise<Message> {
  const reactions = await MessageReaction.findAll({
    where: { messageId: row.id },
    attributes: ['reaction', 'userId'],
  });
  return {
    id: row.id,
    conversationId: row.conversationId,
    senderId: row.senderId,
    senderName: '',
    senderAvatar: null,
    content: row.deletedAt ? DELETED_COPY : row.content,
    attachments: row.deletedAt ? [] : asStoredFiles(row.attachments),
    meeting: row.deletedAt ? null : asMeeting(row.attachments),
    linkPreviews: row.deletedAt ? [] : asLinkPreviews(row.linkPreviews),
    replyToMessageId: row.replyToMessageId,
    replyTo: null,
    replyCount: 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null,
    deletedAt: row.deletedAt?.toISOString() ?? null,
    reactions: groupReactions(reactions),
  };
}

export async function markRead(userId: string, messageId: string) {
  requireDb();
  const row = await MessageModel.findByPk(messageId);
  if (!row) {
    throw new AppError(404, 'MESSAGE_NOT_FOUND', 'Message not found.');
  }
  const member = await membership(row.conversationId, userId);
  member.lastReadMessageId = messageId;
  await member.save();
  emitToConversation(row.conversationId, SOCKET_EVENTS.MESSAGE_READ, {
    conversationId: row.conversationId,
    userId,
    messageId,
  });
  emitToUser(userId, SOCKET_EVENTS.MESSAGE_READ, {
    conversationId: row.conversationId,
    userId,
    messageId,
  });
  return { ok: true };
}

async function hitsFromRows(
  userId: string,
  rows: MessageModel[],
): Promise<MessageSearchHit[]> {
  const conversationIdsFound = [...new Set(rows.map((row) => row.conversationId))];
  const conversations = conversationIdsFound.length
    ? await ConversationModel.findAll({
        where: { id: { [Op.in]: conversationIdsFound } },
      })
    : [];
  const conversationMap = new Map(conversations.map((row) => [row.id, row]));
  const directIds = conversations
    .filter((row) => row.type === CONVERSATION_TYPE.DIRECT)
    .map((row) => row.id);
  const directMembers = directIds.length
    ? await ConversationMember.findAll({
        where: { conversationId: { [Op.in]: directIds } },
        include: [
          {
            model: User,
            required: true,
            attributes: [
              'id',
              'name',
              'email',
              'avatar',
              'designation',
              'department',
              'role',
              'status',
              'lastSeenAt',
              'createdAt',
            ],
          },
        ],
      })
    : [];
  const membersByConversation = new Map<string, PublicUser[]>();
  for (const item of directMembers) {
    const user = item.get('User') as User;
    const list = membersByConversation.get(item.conversationId) ?? [];
    list.push(user.toPublic());
    membersByConversation.set(item.conversationId, list);
  }
  const messages = await serializeMessages(rows);
  return messages.map((message) => {
    const conversation = conversationMap.get(message.conversationId) ?? null;
    return {
      message,
      conversationId: message.conversationId,
      conversationName: conversationLabel(
        conversation,
        membersByConversation.get(message.conversationId) ?? [],
        userId,
      ),
    };
  });
}

async function searchPeopleSql(userId: string, q: string): Promise<PublicUser[]> {
  if (!q.trim()) {
    return [];
  }
  const needle = `%${q.trim()}%`;
  const rows = await User.findAll({
    where: {
      id: { [Op.ne]: userId },
      status: USER_STATUS.ACTIVE,
      [Op.or]: [
        { name: { [Op.iLike]: needle } },
        { email: { [Op.iLike]: needle } },
        { designation: { [Op.iLike]: needle } },
      ],
    },
    attributes: { exclude: ['passwordHash'] },
    limit: 8,
    order: [['name', 'ASC']],
  });
  return rows.map((row) => row.toPublic());
}

export async function searchMessages(
  userId: string,
  query: {
    q?: string;
    senderId?: string;
    conversationId?: string;
    from?: string;
    to?: string;
  },
): Promise<MessageSearchResult> {
  requireDb();
  const empty: MessageSearchResult = {
    items: [],
    people: [],
    suggestions: [],
    completions: [],
    correctedQuery: null,
  };
  const memberships = await ConversationMember.findAll({ where: { userId } });
  let conversationIds = memberships.map((row) => row.conversationId);
  if (query.conversationId) {
    if (!conversationIds.includes(query.conversationId)) {
      throw new AppError(403, 'NOT_A_MEMBER', 'You are not in this conversation.');
    }
    conversationIds = [query.conversationId];
  }
  if (conversationIds.length === 0) {
    return empty;
  }
  const q = query.q?.trim() ?? '';
  const indexed = q
    ? await searchChatIndex(q, conversationIds, {
        senderId: query.senderId,
        from: query.from,
        to: query.to,
        viewerId: userId,
      })
    : null;

  if (indexed) {
    const rows =
      indexed.messageIds.length === 0
        ? []
        : await MessageModel.findAll({
            where: { id: { [Op.in]: indexed.messageIds }, deletedAt: null },
            include: messageInclude,
          });
    const order = new Map(indexed.messageIds.map((id, index) => [id, index]));
    rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    const people =
      indexed.personIds.length === 0
        ? []
        : (
            await User.findAll({
              where: { id: { [Op.in]: indexed.personIds }, status: USER_STATUS.ACTIVE },
              attributes: { exclude: ['passwordHash'] },
            })
          ).map((row) => row.toPublic());
    people.sort(
      (a, b) => indexed.personIds.indexOf(a.id) - indexed.personIds.indexOf(b.id),
    );
    return {
      items: await hitsFromRows(userId, rows),
      people,
      suggestions: indexed.suggestions,
      completions: indexed.completions,
      correctedQuery: indexed.correctedQuery,
    };
  }

  const where: Record<string, unknown> = {
    conversationId: { [Op.in]: conversationIds },
    deletedAt: null,
  };
  if (q) {
    where.content = { [Op.iLike]: `%${q}%` };
  }
  if (query.senderId) {
    where.senderId = query.senderId;
  }
  if (query.from || query.to) {
    where.createdAt = {
      ...(query.from ? { [Op.gte]: new Date(query.from) } : {}),
      ...(query.to ? { [Op.lte]: new Date(query.to) } : {}),
    };
  }
  const rows = await MessageModel.findAll({
    where,
    include: messageInclude,
    order: [['createdAt', 'DESC']],
    limit: 40,
  });
  return {
    items: await hitsFromRows(userId, rows),
    people: await searchPeopleSql(userId, q),
    suggestions: [],
    completions: [],
    correctedQuery: null,
  };
}

export async function unreadTotal(userId: string) {
  requireDb();
  if (!sequelize) {
    return 0;
  }
  const [row] = await sequelize.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM messages m
     INNER JOIN conversation_members cm
       ON cm.conversation_id = m.conversation_id AND cm.user_id = :userId
     LEFT JOIN messages lr ON lr.id = cm.last_read_message_id
     WHERE m.sender_id <> :userId
       AND m.deleted_at IS NULL
       AND (cm.last_read_message_id IS NULL OR m.created_at > lr.created_at)`,
    { replacements: { userId }, type: QueryTypes.SELECT },
  );
  return Number(row?.count ?? 0);
}

export function conversationLabel(
  conversation: ConversationModel | null,
  members: PublicUser[],
  viewerId: string,
) {
  if (!conversation) {
    return 'chat';
  }
  if (conversation.type === CONVERSATION_TYPE.CHANNEL) {
    return `#${conversation.name}`;
  }
  if (conversation.type === CONVERSATION_TYPE.GROUP) {
    return conversation.name ?? 'Group';
  }
  return members.find((member) => member.id !== viewerId)?.name ?? 'Direct message';
}

export async function isMember(conversationId: string, userId: string) {
  const row = await ConversationMember.findOne({ where: { conversationId, userId } });
  return Boolean(row);
}

export { isUserOnline };
