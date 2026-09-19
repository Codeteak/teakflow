import { CONVERSATION_TYPE, USER_STATUS } from '@teakflow/shared';
import type { PublicUser } from '@teakflow/shared';
import { Op } from 'sequelize';
import { connectMeili, isMeiliConfigured, meili } from '../../config/meilisearch';
import { Conversation } from '../../models/conversation';
import { ConversationMember } from '../../models/conversationMember';
import { Message } from '../../models/message';
import { User } from '../../models/user';

export const MESSAGES_INDEX = 'teakflow_messages';
export const PEOPLE_INDEX = 'teakflow_people';

export type IndexedMessage = {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  conversationId: string;
  conversationName: string;
  createdAt: number;
};

export type IndexedPerson = {
  id: string;
  name: string;
  email: string;
  designation: string;
  department: string;
  role: string;
  status: string;
};

let ready: Promise<boolean> | null = null;

export function conversationIdFilter(ids: string[]) {
  if (ids.length === 0) {
    return null;
  }
  return `conversationId IN [${ids.map((id) => `"${id}"`).join(', ')}]`;
}

export function levenshtein(a: string, b: string) {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  const rows = left.length + 1;
  const cols = right.length + 1;
  const grid = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i += 1) grid[i]![0] = i;
  for (let j = 0; j < cols; j += 1) grid[0]![j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      grid[i]![j] = Math.min(
        grid[i - 1]![j]! + 1,
        grid[i]![j - 1]! + 1,
        grid[i - 1]![j - 1]! + cost,
      );
    }
  }
  return grid[left.length]![right.length]!;
}

export function closestCorrection(query: string, texts: string[]): string | null {
  const needle = query.trim();
  if (needle.length < 3) {
    return null;
  }
  let best: { word: string; distance: number } | null = null;
  for (const text of texts) {
    for (const word of text.split(/[^\p{L}\p{N}]+/u).filter((item) => item.length >= 3)) {
      const distance = levenshtein(needle, word);
      if (distance === 0) {
        return null;
      }
      if (distance <= 2 && (!best || distance < best.distance)) {
        best = { word, distance };
      }
    }
  }
  return best?.word ?? null;
}

async function ensureIndexes() {
  await meili.createIndex(MESSAGES_INDEX, { primaryKey: 'id' }).catch(() => undefined);
  await meili.createIndex(PEOPLE_INDEX, { primaryKey: 'id' }).catch(() => undefined);
  const messages = meili.index(MESSAGES_INDEX);
  const people = meili.index(PEOPLE_INDEX);
  await messages.updateSettings({
    searchableAttributes: ['content', 'senderName', 'conversationName'],
    filterableAttributes: ['conversationId', 'senderId', 'createdAt'],
    sortableAttributes: ['createdAt'],
    displayedAttributes: [
      'id',
      'content',
      'senderId',
      'senderName',
      'conversationId',
      'conversationName',
      'createdAt',
    ],
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: { oneTypo: 3, twoTypos: 6 },
    },
    pagination: { maxTotalHits: 1000 },
  });
  await people.updateSettings({
    searchableAttributes: ['name', 'email', 'designation', 'department', 'role'],
    filterableAttributes: ['status', 'role'],
    displayedAttributes: [
      'id',
      'name',
      'email',
      'designation',
      'department',
      'role',
      'status',
    ],
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: { oneTypo: 3, twoTypos: 6 },
    },
  });
}

export async function ensureSearchReady() {
  if (!ready) {
    ready = (async () => {
      const ok = await connectMeili();
      if (!ok) {
        return false;
      }
      await ensureIndexes();
      return true;
    })().catch(() => false);
  }
  return ready;
}

export async function indexMessageDocument(doc: IndexedMessage) {
  if (!(await ensureSearchReady()) || !doc.content.trim()) {
    return;
  }
  await meili.index(MESSAGES_INDEX).addDocuments([doc]);
}

export async function removeMessageDocument(id: string) {
  if (!(await ensureSearchReady())) {
    return;
  }
  await meili.index(MESSAGES_INDEX).deleteDocument(id);
}

export async function indexPerson(user: PublicUser) {
  if (!(await ensureSearchReady())) {
    return;
  }
  if (user.status !== USER_STATUS.ACTIVE) {
    await meili.index(PEOPLE_INDEX).deleteDocument(user.id);
    return;
  }
  const doc: IndexedPerson = {
    id: user.id,
    name: user.name,
    email: user.email,
    designation: user.designation ?? '',
    department: user.department ?? '',
    role: user.role,
    status: user.status,
  };
  await meili.index(PEOPLE_INDEX).addDocuments([doc]);
}

export async function indexMessageRow(row: {
  id: string;
  content: string;
  senderId: string;
  conversationId: string;
  createdAt: Date;
  deletedAt: Date | null;
}) {
  if (row.deletedAt || !row.content.trim()) {
    await removeMessageDocument(row.id);
    return;
  }
  const conversation = await Conversation.findByPk(row.conversationId);
  const sender = await User.findByPk(row.senderId, { attributes: ['name'] });
  let conversationName = conversation?.name ? `#${conversation.name}` : 'Chat';
  if (conversation?.type === CONVERSATION_TYPE.GROUP) {
    conversationName = conversation.name ?? 'Group';
  }
  if (conversation?.type === CONVERSATION_TYPE.DIRECT) {
    const members = await ConversationMember.findAll({
      where: { conversationId: row.conversationId },
      include: [{ model: User, attributes: ['id', 'name'] }],
    });
    const other = members
      .find((member) => member.userId !== row.senderId)
      ?.get('User') as User | undefined;
    conversationName = other?.name ?? 'Direct message';
  }
  await indexMessageDocument({
    id: row.id,
    content: row.content,
    senderId: row.senderId,
    senderName: sender?.name ?? 'Employee',
    conversationId: row.conversationId,
    conversationName,
    createdAt: Math.floor(row.createdAt.getTime() / 1000),
  });
}

export type ChatIndexSearch = {
  messageIds: string[];
  personIds: string[];
  suggestions: string[];
  completions: string[];
  correctedQuery: string | null;
};

export async function searchChatIndex(
  query: string,
  conversationIds: string[],
  options: { senderId?: string; from?: string; to?: string; viewerId: string },
): Promise<ChatIndexSearch | null> {
  try {
    if (!(await ensureSearchReady()) || !isMeiliConfigured()) {
      return null;
    }
    const q = query.trim();
    const filterParts: string[] = [];
    const idFilter = conversationIdFilter(conversationIds);
    if (!idFilter) {
      return {
        messageIds: [],
        personIds: [],
        suggestions: [],
        completions: [],
        correctedQuery: null,
      };
    }
    filterParts.push(idFilter);
    if (options.senderId) {
      filterParts.push(`senderId = "${options.senderId}"`);
    }
    if (options.from) {
      filterParts.push(
        `createdAt >= ${Math.floor(new Date(options.from).getTime() / 1000)}`,
      );
    }
    if (options.to) {
      filterParts.push(
        `createdAt <= ${Math.floor(new Date(options.to).getTime() / 1000)}`,
      );
    }

    const [messages, people] = await Promise.all([
      meili.index(MESSAGES_INDEX).search<IndexedMessage>(q, {
        filter: filterParts.join(' AND '),
        limit: 40,
        attributesToCrop: ['content'],
        cropLength: 8,
        matchingStrategy: 'last',
      }),
      meili.index(PEOPLE_INDEX).search<IndexedPerson>(q, {
        filter: `status = "${USER_STATUS.ACTIVE}"`,
        limit: 8,
        matchingStrategy: 'last',
      }),
    ]);

    const messageHits = messages.hits as IndexedMessage[];
    const peopleHits = people.hits as IndexedPerson[];
    const cropped = messageHits
      .map((hit) => {
        const formatted = (hit as IndexedMessage & { _formatted?: { content?: string } })
          ._formatted?.content;
        return (formatted ?? hit.content).replace(/<\/?em>/g, '').trim();
      })
      .filter(Boolean);
    const completions = [...new Set(cropped)].slice(0, 6);
    const nameHits = [
      ...messageHits.map((hit) => hit.senderName),
      ...messageHits.map((hit) => hit.conversationName),
      ...peopleHits.map((hit) => hit.name),
    ].filter(Boolean);
    const suggestions = [...new Set([...completions, ...nameHits])].slice(0, 8);
    const personIds = peopleHits
      .map((hit) => hit.id)
      .filter((id) => id !== options.viewerId);
    const correctedQuery = closestCorrection(q, [
      ...messageHits.map((hit) => hit.content),
      ...messageHits.map((hit) => hit.senderName),
      ...peopleHits.map((hit) => hit.name),
    ]);

    return {
      messageIds: messageHits.map((hit) => hit.id),
      personIds,
      suggestions,
      completions,
      correctedQuery,
    };
  } catch {
    return null;
  }
}

export async function reindexChatSearch() {
  if (!(await ensureSearchReady())) {
    return false;
  }
  const [messages, users] = await Promise.all([
    Message.findAll({
      where: { deletedAt: null, content: { [Op.ne]: '' } },
      attributes: [
        'id',
        'content',
        'senderId',
        'conversationId',
        'createdAt',
        'deletedAt',
      ],
      limit: 5000,
      order: [['createdAt', 'DESC']],
    }),
    User.findAll({
      where: { status: USER_STATUS.ACTIVE },
      attributes: { exclude: ['passwordHash'] },
    }),
  ]);
  await Promise.all(users.map((user) => indexPerson(user.toPublic())));
  for (const row of messages) {
    await indexMessageRow(row);
  }
  return true;
}
