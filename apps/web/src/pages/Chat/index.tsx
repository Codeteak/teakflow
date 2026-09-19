import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CHANNEL_VISIBILITY,
  CONVERSATION_TYPE,
  DEPARTMENTS,
  PRESENCE_STATUS,
  ROLES,
  extractHttpUrls,
  fileKindFrom,
  messageSnippet,
  type Conversation,
  type Department,
  type LinkPreview,
  type Message,
  type MessageSearchResult,
  type PresenceStatus,
  type PublicUser,
  type StoredFile,
} from '@teakflow/shared';
import {
  ChevronLeft,
  MessageSquarePlus,
  Pencil,
  Reply,
  Search,
  SmilePlus,
  Trash2,
  Users,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { AnimatedEmoji } from '@/components/chat/AnimatedEmoji';
import { EmojiPickerShell } from '@/components/chat/AnimatedEmojiPicker';
import { ReactionPeopleModal } from '@/components/chat/ReactionPeopleModal';
import { PeopleSearchPicker } from '@/components/chat/PeopleSearchPicker';
import {
  FilePreviewModal,
  LinkPreviewCard,
  MessageAttachments,
  MessageText,
  ComposerFilePreview,
  VoiceNotePlayer,
  type ComposerFile,
} from '@/components/chat/MessageMedia';
import {
  MessageReceiptTicks,
  messageReceiptStatus,
} from '@/components/chat/MessageReceiptTicks';
import { AIChatInput } from '@/components/ui/ai-chat-input';
import { Button } from '@/components/ui/button';
import { IconTooltipButton } from '@/components/ui/icon-tooltip-button';
import { GoogleMeetIcon } from '@/components/ui/google-meet-icon';
import { Input } from '@/components/ui/input';
import {
  addReactionRequest,
  createConversationRequest,
  deleteMessageRequest,
  editMessageRequest,
  getConversationRequest,
  listConversationsRequest,
  listMessagesRequest,
  markReadRequest,
  removeReactionRequest,
  searchMessagesRequest,
  sendMessageRequest,
} from '@/features/chat/api';
import { conversationPreview, conversationTitle } from '@/features/chat/labels';
import { listUsersRequest } from '@/features/employees/api';
import { previewLinkRequest, uploadFileRequest } from '@/features/files/api';
import {
  joinConversationRoom,
  sendMessageLive,
  subscribeChatSocket,
  emitTyping,
} from '@/services/socket/chat';
import { useAuthStore } from '@/store/auth';
import { selectOtherUnread, useChatUnreadStore } from '@/store/chatUnread';
import {
  avatarStatusFromPresence,
  presenceLabel,
  usePresenceStore,
} from '@/store/presence';
import { CountBadge } from '@/components/ui/count-badge';
import { EmptyState, ErrorBanner, ListLoading } from '@/components/ui/page-state';
import { Typing } from '@/components/ui/typing';
import {
  Bubble,
  BubbleContent,
  BubbleGroup,
  BubbleReactions,
} from '@/components/ui/bubble';
import { cn } from '@/lib/cn';

function mergeMessage(existing: Message, incoming: Message): Message {
  return {
    ...existing,
    ...incoming,
    senderName: incoming.senderName || existing.senderName,
    senderAvatar: incoming.senderAvatar ?? existing.senderAvatar,
    attachments: incoming.attachments?.length
      ? incoming.attachments
      : (existing.attachments ?? []),
    meeting: incoming.meeting ?? existing.meeting ?? null,
    linkPreviews: incoming.linkPreviews?.length
      ? incoming.linkPreviews
      : (existing.linkPreviews ?? []),
    replyTo: incoming.replyTo ?? existing.replyTo,
    replyCount: incoming.replyCount || existing.replyCount,
    reactions: incoming.reactions ?? existing.reactions,
  };
}

function withReaction(
  message: Message,
  viewerId: string,
  reaction: string,
  add: boolean,
): Message {
  const groups = message.reactions.map((row) => ({ ...row, userIds: [...row.userIds] }));
  const index = groups.findIndex((row) => row.reaction === reaction);
  if (add) {
    if (index === -1) {
      groups.push({ reaction, count: 1, userIds: [viewerId] });
    } else if (!groups[index]!.userIds.includes(viewerId)) {
      groups[index]!.userIds.push(viewerId);
      groups[index]!.count = groups[index]!.userIds.length;
    }
  } else if (index !== -1) {
    groups[index]!.userIds = groups[index]!.userIds.filter((id) => id !== viewerId);
    groups[index]!.count = groups[index]!.userIds.length;
    if (groups[index]!.count === 0) {
      groups.splice(index, 1);
    }
  }
  return { ...message, reactions: groups };
}

function mergeChatMessages(
  fromApi: Message[],
  current: Message[],
  conversationId: string,
) {
  const map = new Map<string, Message>();
  for (const row of fromApi) {
    map.set(row.id, row);
  }
  for (const row of current) {
    if (row.conversationId !== conversationId || row.id.startsWith('temp-')) {
      continue;
    }
    if (!map.has(row.id)) {
      map.set(row.id, row);
    }
  }
  return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function ChatPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const viewerId = user?.id ?? '';
  const otherUnread = useChatUnreadStore(selectOtherUnread);
  const hydrateUnread = useChatUnreadStore((state) => state.hydrate);
  const clearUnread = useChatUnreadStore((state) => state.clear);

  const [list, setList] = useState<Conversation[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [search, setSearch] = useState('');
  const [hits, setHits] = useState<MessageSearchResult | null>(null);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [thread, setThread] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [typingIds, setTypingIds] = useState<string[]>([]);
  const [listError, setListError] = useState('');
  const presenceByUser = usePresenceStore((state) => state.byUserId);
  const hydrateOnline = usePresenceStore((state) => state.hydrateOnline);
  const [composerError, setComposerError] = useState('');
  const [voiceSending, setVoiceSending] = useState(false);
  const [composerFiles, setComposerFiles] = useState<ComposerFile[]>([]);
  const [pendingLink, setPendingLink] = useState<LinkPreview | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [previewFile, setPreviewFile] = useState<StoredFile | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightTimer = useRef<number | undefined>(undefined);
  const [dragOver, setDragOver] = useState(false);
  const dragDepth = useRef(0);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [groupVisibility, setGroupVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PRIVATE');
  const [groupDepartment, setGroupDepartment] = useState('');
  const [dmOpen, setDmOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<number | undefined>(undefined);
  const searchTimer = useRef<number | undefined>(undefined);
  const ogTimer = useRef<number | undefined>(undefined);
  const ogUrlRef = useRef('');
  const conversationIdRef = useRef(conversationId);
  const listRef = useRef(list);
  const seenLiveIds = useRef(new Set<string>());
  conversationIdRef.current = conversationId;
  listRef.current = list;

  const refreshList = useCallback(async () => {
    const data = await listConversationsRequest();
    setList(data.items);
    hydrateUnread(data.items);
    const onlineIds = data.items.flatMap((item) => item.onlineUserIds ?? []);
    hydrateOnline(onlineIds);
    return data.items;
  }, [hydrateOnline, hydrateUnread]);

  useEffect(() => {
    let cancelled = false;
    setListError('');
    refreshList()
      .then((items) => {
        if (cancelled) return;
        if (!conversationIdRef.current && items[0] && window.innerWidth >= 768) {
          navigate(`/chat/${items[0].id}`, { replace: true });
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setListError(
            cause instanceof Error ? cause.message : 'Unable to load conversations.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate, refreshList]);

  useEffect(() => {
    let cancelled = false;
    listUsersRequest()
      .then((people) => {
        if (!cancelled) setUsers(people);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!newGroupOpen || users.length > 0) return;
    void listUsersRequest()
      .then(setUsers)
      .catch(() => undefined);
  }, [newGroupOpen, users.length]);

  useEffect(() => {
    if (!conversationId) {
      setActive(null);
      setMessages([]);
      setLoadingMessages(false);
      return;
    }

    const cached = listRef.current.find((item) => item.id === conversationId) ?? null;
    setActive(cached);
    setTypingIds([]);
    setThread(null);
    setReplyTo(null);
    setEditing(null);
    setComposerFiles((current) => {
      for (const file of current) {
        URL.revokeObjectURL(file.previewUrl);
      }
      return [];
    });
    setPendingLink(null);
    setLinkLoading(false);
    ogUrlRef.current = '';
    setDragOver(false);
    dragDepth.current = 0;
    setLoadingMessages(true);
    setMessages((current) =>
      current.length > 0 && current[0]?.conversationId === conversationId ? current : [],
    );
    joinConversationRoom(conversationId);

    let cancelled = false;

    void listMessagesRequest(conversationId)
      .then((rows) => {
        if (cancelled) return;
        setMessages((current) => mergeChatMessages(rows, current, conversationId));
        const last = rows.at(-1);
        if (last) {
          void markReadRequest(last.id)
            .then(() => {
              if (!viewerId) return;
              setActive((current) => {
                if (!current || current.id !== conversationId) return current;
                return {
                  ...current,
                  members: current.members.map((member) =>
                    member.userId === viewerId
                      ? { ...member, lastReadMessageId: last.id }
                      : member,
                  ),
                };
              });
            })
            .catch(() => undefined);
          clearUnread(conversationId);
          setList((current) =>
            current.map((item) =>
              item.id === conversationId ? { ...item, unreadCount: 0 } : item,
            ),
          );
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoadingMessages(false);
      });

    void getConversationRequest(conversationId)
      .then((conversation) => {
        if (!cancelled) setActive(conversation);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [clearUnread, conversationId, viewerId]);

  useEffect(() => {
    return subscribeChatSocket({
      onMessage(message) {
        const openId = conversationIdRef.current;
        const alreadySeen = seenLiveIds.current.has(message.id);
        seenLiveIds.current.add(message.id);
        setMessages((current) => {
          if (message.conversationId !== openId) {
            return current;
          }
          if (current.some((row) => row.id === message.id)) {
            return current.map((row) =>
              row.id === message.id ? mergeMessage(row, message) : row,
            );
          }
          const next = [...current, message];
          if (message.replyToMessageId) {
            return next.map((row) =>
              row.id === message.replyToMessageId
                ? { ...row, replyCount: row.replyCount + 1 }
                : row,
            );
          }
          return next;
        });
        setList((current) => {
          const existing = current.find((item) => item.id === message.conversationId);
          if (!existing) {
            void refreshList();
            return current;
          }
          const skipUnread =
            alreadySeen ||
            message.conversationId === openId ||
            message.senderId === viewerId;
          return current.map((item) => {
            if (item.id !== message.conversationId) {
              return item;
            }
            return {
              ...item,
              unreadCount: skipUnread ? item.unreadCount : item.unreadCount + 1,
              lastMessage: {
                id: message.id,
                senderId: message.senderId,
                senderName: message.senderName,
                content: messageSnippet(message.content, message.attachments ?? []),
                createdAt: message.createdAt,
              },
            };
          });
        });
        if (message.conversationId === openId) {
          void markReadRequest(message.id).catch(() => undefined);
        }
      },
      onMessageUpdate(message) {
        setMessages((current) =>
          current.map((row) =>
            row.id === message.id ? mergeMessage(row, message) : row,
          ),
        );
      },
      onTyping({ conversationId: id, userId, typing }) {
        if (id !== conversationIdRef.current || userId === viewerId) return;
        setTypingIds((current) => {
          const next = new Set(current);
          if (typing) next.add(userId);
          else next.delete(userId);
          return [...next];
        });
      },
      onPresence() {
        /* presence store updated in socket layer */
      },
      onRead({ conversationId: id, userId, messageId }) {
        setActive((current) => {
          if (!current || current.id !== id) {
            return current;
          }
          return {
            ...current,
            members: current.members.map((member) =>
              member.userId === userId
                ? { ...member, lastReadMessageId: messageId }
                : member,
            ),
          };
        });
        setList((current) =>
          current.map((item) => {
            if (item.id !== id) {
              return item;
            }
            return {
              ...item,
              members: item.members.map((member) =>
                member.userId === userId
                  ? { ...member, lastReadMessageId: messageId }
                  : member,
              ),
            };
          }),
        );
      },
    });
  }, [refreshList, viewerId]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages.length]);

  const directs = list.filter(
    (item) => item.type === CONVERSATION_TYPE.DIRECT && item.lastMessage,
  );
  const groups = list.filter((item) => item.type === CONVERSATION_TYPE.GROUP);
  const channels = list.filter((item) => item.type === CONVERSATION_TYPE.CHANNEL);

  const dmExcludeIds = useMemo(() => {
    const ids = new Set<string>([viewerId]);
    for (const item of directs) {
      for (const member of item.members) {
        if (member.userId !== viewerId) {
          ids.add(member.userId);
        }
      }
    }
    return [...ids];
  }, [directs, viewerId]);

  const mentionOptions = useMemo(() => {
    const at = draft.lastIndexOf('@');
    if (at < 0) return [];
    const needle = draft.slice(at + 1).toLowerCase();
    if (needle.includes(' ')) return [];
    return (active?.members ?? [])
      .map((member) => member.user)
      .filter(
        (person) => person.id !== viewerId && person.name.toLowerCase().includes(needle),
      )
      .slice(0, 6);
  }, [active, draft, viewerId]);

  function onSearchChange(value: string) {
    setSearch(value);
    window.clearTimeout(searchTimer.current);
    if (value.trim().length < 2) {
      setHits(null);
      return;
    }
    searchTimer.current = window.setTimeout(() => {
      void searchMessagesRequest({ q: value.trim() })
        .then(setHits)
        .catch(() => undefined);
    }, 250);
  }

  async function persistMessage(
    text: string,
    files: StoredFile[],
    previews: LinkPreview[] = [],
    staged: ComposerFile[] = [],
  ) {
    if (!conversationId || !user) return;
    if (!text && files.length === 0) return;
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic: Message = {
      id: tempId,
      conversationId,
      senderId: user.id,
      senderName: user.name,
      senderAvatar: user.avatar,
      content: text,
      attachments: files,
      meeting: null,
      linkPreviews: previews,
      replyToMessageId: replyTo?.id ?? null,
      replyTo: replyTo
        ? {
            id: replyTo.id,
            senderId: replyTo.senderId,
            senderName: replyTo.senderName,
            content: replyTo.content,
            createdAt: replyTo.createdAt,
            attachments: replyTo.attachments ?? [],
          }
        : null,
      replyCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      editedAt: null,
      deletedAt: null,
      reactions: [],
    };
    setMessages((current) => [...current, optimistic]);
    const shouldClearComposer = Boolean(text) || staged.length > 0;
    if (shouldClearComposer) {
      setDraft('');
      setComposerFiles([]);
      setPendingLink(null);
    }
    setReplyTo(null);
    emitTyping(conversationId, false);

    try {
      const created = await sendMessageLive(
        conversationId,
        text,
        optimistic.replyToMessageId,
        files,
        previews,
      ).catch(() =>
        sendMessageRequest(
          conversationId,
          text,
          optimistic.replyToMessageId,
          files,
          previews,
        ),
      );
      for (const file of staged) {
        URL.revokeObjectURL(file.previewUrl);
      }
      setMessages((current) => {
        const withoutTemp = current.filter((row) => row.id !== tempId);
        const merged = withoutTemp.some((row) => row.id === created.id)
          ? withoutTemp.map((row) =>
              row.id === created.id ? mergeMessage(row, created) : row,
            )
          : [...withoutTemp, mergeMessage(optimistic, created)];
        if (
          !optimistic.replyToMessageId ||
          withoutTemp.some((row) => row.id === created.id)
        ) {
          return merged;
        }
        return merged.map((row) =>
          row.id === optimistic.replyToMessageId
            ? { ...row, replyCount: row.replyCount + 1 }
            : row,
        );
      });
    } catch (cause) {
      setMessages((current) => current.filter((row) => row.id !== tempId));
      if (shouldClearComposer) {
        setDraft(text);
        setComposerFiles(staged);
        setPendingLink(previews[0] ?? null);
      }
      setComposerError(cause instanceof Error ? cause.message : 'Unable to send.');
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!conversationId || !user) return;
    const text = draft.trim();
    const files = composerFiles
      .map((file) => file.stored)
      .filter((file): file is StoredFile => Boolean(file));
    const previews = pendingLink ? [pendingLink] : [];
    if (!text && files.length === 0) return;
    if (composerFiles.some((file) => !file.stored)) {
      setComposerError('Wait for the upload to finish.');
      return;
    }
    setComposerError('');
    if (editing) {
      if (!text) return;
      try {
        const updated = await editMessageRequest(editing.id, text);
        setMessages((current) =>
          current.map((row) =>
            row.id === updated.id ? mergeMessage(row, updated) : row,
          ),
        );
        setEditing(null);
        setDraft('');
      } catch (cause) {
        setComposerError(cause instanceof Error ? cause.message : 'Unable to send.');
      }
      return;
    }

    await persistMessage(text, files, previews, composerFiles);
  }

  async function sendVoiceNote(file: File) {
    if (!conversationId || !user || editing) {
      return;
    }
    setComposerError('');
    setVoiceSending(true);
    try {
      const stored = await uploadFileRequest(file, 'chat');
      await persistMessage('', [stored]);
    } catch (error) {
      setComposerError(
        error instanceof Error ? error.message : 'Could not send the voice message.',
      );
    } finally {
      setVoiceSending(false);
    }
  }

  async function attachFiles(files: File[]) {
    if (!files.length || editing) {
      return;
    }
    setComposerError('');
    const staged: ComposerFile[] = files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      kind: fileKindFrom(file.type, file.name),
      previewUrl: URL.createObjectURL(file),
      stored: null,
    }));
    setComposerFiles((current) => [...current, ...staged]);
    try {
      await Promise.all(
        staged.map(async (row, index) => {
          const stored = await uploadFileRequest(files[index]!, 'chat');
          setComposerFiles((current) =>
            current.map((item) => (item.id === row.id ? { ...item, stored } : item)),
          );
        }),
      );
    } catch (error) {
      setComposerError(
        error instanceof Error ? error.message : 'Could not upload the file.',
      );
    }
  }

  function onDraft(value: string) {
    setDraft(value);
    if (!conversationId) return;
    emitTyping(conversationId, true);
    window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(
      () => emitTyping(conversationId, false),
      1200,
    );
    window.clearTimeout(ogTimer.current);
    const url = extractHttpUrls(value)[0] ?? '';
    if (!url) {
      ogUrlRef.current = '';
      setPendingLink(null);
      setLinkLoading(false);
      return;
    }
    if (url === ogUrlRef.current) {
      return;
    }
    ogUrlRef.current = url;
    setLinkLoading(true);
    setPendingLink(null);
    ogTimer.current = window.setTimeout(() => {
      void previewLinkRequest(url)
        .then((preview) => {
          if (ogUrlRef.current !== url) {
            return;
          }
          setPendingLink(preview);
        })
        .catch(() => {
          if (ogUrlRef.current !== url) {
            return;
          }
          setPendingLink(null);
        })
        .finally(() => {
          if (ogUrlRef.current === url) {
            setLinkLoading(false);
          }
        });
    }, 450);
  }

  function insertMention(name: string) {
    const at = draft.lastIndexOf('@');
    setDraft(`${draft.slice(0, at)}@${name} `);
  }

  function jumpToMessage(id: string) {
    const el = document.getElementById(`message-${id}`);
    if (!el) {
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightId(id);
    window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => setHighlightId(null), 1600);
  }

  function onComposerKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  async function startDirect(userId: string) {
    const conversation = await createConversationRequest({
      type: CONVERSATION_TYPE.DIRECT,
      userId,
    });
    await refreshList();
    navigate(`/chat/${conversation.id}`);
  }

  async function createGroup(event: FormEvent) {
    event.preventDefault();
    if (!groupName.trim()) return;
    const isPublic = groupVisibility === 'PUBLIC' && user?.role !== ROLES.EMPLOYEE;
    if (!isPublic && groupMembers.length === 0) return;
    const conversation = await createConversationRequest({
      type: CONVERSATION_TYPE.GROUP,
      name: groupName.trim(),
      visibility: isPublic ? CHANNEL_VISIBILITY.PUBLIC : CHANNEL_VISIBILITY.PRIVATE,
      memberIds: isPublic ? [] : groupMembers,
      department:
        isPublic && user?.role === ROLES.ADMIN && groupDepartment
          ? (groupDepartment as Department)
          : null,
    });
    setNewGroupOpen(false);
    setGroupName('');
    setGroupMembers([]);
    setGroupVisibility('PRIVATE');
    setGroupDepartment('');
    await refreshList();
    navigate(`/chat/${conversation.id}`);
  }

  const showPane = Boolean(conversationId);
  const typingNames = typingIds
    .map(
      (id) =>
        active?.members.find((member) => member.userId === id)?.user.name.split(' ')[0],
    )
    .filter((name): name is string => Boolean(name));
  const typingLabel =
    typingNames.length === 0
      ? ''
      : typingNames.length === 1
        ? `${typingNames[0]} is typing`
        : typingNames.length === 2
          ? `${typingNames[0]} and ${typingNames[1]} are typing`
          : `${typingNames[0]} and ${typingNames.length - 1} others are typing`;

  const threadReplies = thread
    ? messages.filter((row) => row.replyToMessageId === thread.id)
    : [];
  const messagesById = useMemo(() => {
    const map = new Map<string, Message>();
    for (const row of messages) {
      map.set(row.id, row);
    }
    return map;
  }, [messages]);
  const peopleById = useMemo(() => {
    const map = new Map<string, PublicUser>();
    for (const person of users) {
      map.set(person.id, person);
    }
    for (const member of active?.members ?? []) {
      map.set(member.userId, member.user);
    }
    return map;
  }, [active?.members, users]);
  const dmPeer =
    active?.type === CONVERSATION_TYPE.DIRECT
      ? (active.members.find((member) => member.userId !== viewerId)?.user ?? null)
      : null;
  const messageGroups = useMemo(() => {
    const groups: Message[][] = [];
    for (const message of messages) {
      const last = groups.at(-1);
      if (last?.[0] && last[0].senderId === message.senderId) {
        last.push(message);
      } else {
        groups.push([message]);
      }
    }
    return groups;
  }, [messages]);

  return (
    <div className="flex h-full min-h-0">
      <aside
        className={cn(
          'flex w-full flex-col border-r border-line bg-paper md:w-72',
          showPane && 'hidden md:flex',
        )}
      >
        <div className="border-b border-line p-4">
          <div className="flex h-10 items-center gap-2 rounded-md border border-line bg-surface px-3 text-sm text-muted">
            <Search size={14} />
            <input
              value={search}
              onChange={(event) => void onSearchChange(event.target.value)}
              className="w-full bg-transparent text-sm text-ink outline-none"
              placeholder="Search chats and people"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 scrollbar-none">
          {hits ? (
            <div className="space-y-3">
              {hits.correctedQuery ? (
                <p className="px-2 text-xs text-muted">
                  Showing spelling close to{' '}
                  <span className="font-medium text-ink">{hits.correctedQuery}</span>
                </p>
              ) : null}
              {hits.completions.length > 0 || hits.suggestions.length > 0 ? (
                <div className="flex flex-wrap gap-1 px-2">
                  {[...new Set([...hits.completions, ...hits.suggestions])]
                    .slice(0, 8)
                    .map((item) => (
                      <button
                        key={item}
                        type="button"
                        className="rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink hover:bg-line/50"
                        onClick={() => void onSearchChange(item)}
                      >
                        {item}
                      </button>
                    ))}
                </div>
              ) : null}
              {hits.people.length > 0 ? (
                <div className="space-y-1">
                  <p className="px-2 pb-1 text-[11px] font-medium tracking-wide text-muted uppercase">
                    People
                  </p>
                  {hits.people.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-line/50"
                      onClick={() => {
                        setHits(null);
                        setSearch('');
                        void startDirect(person.id);
                      }}
                    >
                      <Avatar name={person.name} src={person.avatar} size={36} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {person.name}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {person.designation ?? person.role}
                          {person.department ? ` · ${person.department}` : ''}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="space-y-1">
                <p className="px-2 pb-2 text-[11px] font-medium tracking-wide text-muted uppercase">
                  Messages
                </p>
                {hits.items.length === 0 ? (
                  <p className="px-2 text-sm text-muted">No message matches.</p>
                ) : null}
                {hits.items.map((hit) => (
                  <button
                    key={hit.message.id}
                    className="mb-0.5 w-full rounded-md px-2.5 py-2 text-left hover:bg-line/50"
                    onClick={() => navigate(`/chat/${hit.conversationId}`)}
                  >
                    <span className="block text-sm font-medium">
                      {hit.conversationName}
                    </span>
                    <span className="block text-xs text-muted">
                      {hit.message.content}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {listError ? (
                <ErrorBanner message={listError} className="mx-2 mb-2" />
              ) : null}
              {loadingList ? <ListLoading rows={6} /> : null}
              {!loadingList ? (
                <Section title="Direct">
                  {directs.map((item) => (
                    <ConversationButton
                      key={item.id}
                      item={item}
                      viewerId={viewerId}
                      presenceByUser={presenceByUser}
                      active={item.id === conversationId}
                      onClick={() => navigate(`/chat/${item.id}`)}
                    />
                  ))}
                  {directs.length === 0 ? (
                    <EmptyState
                      title="No direct chats yet"
                      description="Search for someone above to start a DM."
                      className="px-2 py-4 text-left"
                    />
                  ) : null}
                </Section>
              ) : null}
              {groups.length > 0 ? (
                <Section title="Groups">
                  {groups.map((item) => (
                    <ConversationButton
                      key={item.id}
                      item={item}
                      viewerId={viewerId}
                      presenceByUser={presenceByUser}
                      active={item.id === conversationId}
                      onClick={() => navigate(`/chat/${item.id}`)}
                    />
                  ))}
                </Section>
              ) : null}
              <Section title="Channels">
                {channels.map((item) => (
                  <ConversationButton
                    key={item.id}
                    item={item}
                    viewerId={viewerId}
                    presenceByUser={presenceByUser}
                    active={item.id === conversationId}
                    onClick={() => navigate(`/chat/${item.id}`)}
                  />
                ))}
                {!loadingList && channels.length === 0 ? (
                  <EmptyState title="No channels yet" className="px-2 py-4 text-left" />
                ) : null}
              </Section>
            </>
          )}
        </div>
        {dmOpen ? (
          <div className="border-t border-line p-3">
            <PeopleSearchPicker
              mode="single"
              people={users}
              excludeIds={dmExcludeIds}
              placeholder="Search anyone to message"
              onSelect={(person) => {
                setDmOpen(false);
                void startDirect(person.id);
              }}
            />
          </div>
        ) : null}
        {newGroupOpen ? (
          <form
            className="max-h-72 space-y-2 overflow-y-auto border-t border-line p-3 scrollbar-none"
            onSubmit={(event) => void createGroup(event)}
          >
            <Input
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="Group name"
            />
            {user?.role !== ROLES.EMPLOYEE ? (
              <select
                className="h-10 w-full rounded-md border border-line bg-surface px-3 text-sm"
                value={groupVisibility}
                onChange={(event) =>
                  setGroupVisibility(event.target.value as 'PUBLIC' | 'PRIVATE')
                }
              >
                <option value="PRIVATE">Private — chosen people</option>
                <option value="PUBLIC">
                  {user?.role === ROLES.MANAGER || user?.role === ROLES.LEAD
                    ? 'Public — your reporting tree'
                    : 'Public — company or department'}
                </option>
              </select>
            ) : null}
            {user?.role === ROLES.ADMIN && groupVisibility === 'PUBLIC' ? (
              <select
                className="h-10 w-full rounded-md border border-line bg-surface px-3 text-sm"
                value={groupDepartment}
                onChange={(event) => setGroupDepartment(event.target.value)}
              >
                <option value="">Whole company</option>
                {DEPARTMENTS.map((department) => (
                  <option key={department} value={department}>
                    {department} only
                  </option>
                ))}
              </select>
            ) : null}
            {groupVisibility === 'PUBLIC' && user?.role !== ROLES.EMPLOYEE ? (
              <p className="text-xs text-muted">
                {user?.role === ROLES.MANAGER || user?.role === ROLES.LEAD
                  ? 'People in your reporting tree join now. New reports join automatically.'
                  : groupDepartment
                    ? `Everyone in ${groupDepartment} joins now. New people in that department join automatically.`
                    : 'Everyone joins now. New employees and managers join automatically.'}
              </p>
            ) : (
              <>
                <p className="text-xs text-muted">
                  Search and add anyone in the company.
                </p>
                <PeopleSearchPicker
                  mode="multi"
                  people={users}
                  excludeIds={[viewerId]}
                  selectedIds={groupMembers}
                  onChange={setGroupMembers}
                  placeholder="Search people to add"
                />
              </>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={
                !groupName.trim() ||
                (groupVisibility !== 'PUBLIC' && groupMembers.length === 0)
              }
            >
              Create group
            </Button>
          </form>
        ) : null}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-3 py-3">
          <IconTooltipButton
            label="New message"
            active={dmOpen}
            onClick={() => {
              setDmOpen((open) => !open);
              setNewGroupOpen(false);
            }}
          >
            <MessageSquarePlus size={18} strokeWidth={1.75} />
          </IconTooltipButton>
          <IconTooltipButton
            label="New group"
            active={newGroupOpen}
            onClick={() => {
              setNewGroupOpen((open) => !open);
              setDmOpen(false);
            }}
          >
            <Users size={18} strokeWidth={1.75} />
          </IconTooltipButton>
        </div>
      </aside>

      <section
        className={cn(
          'relative min-w-0 flex-1 flex-col bg-surface',
          showPane ? 'flex' : 'hidden md:flex',
        )}
        onDragEnter={(event) => {
          if (!active || editing || !event.dataTransfer.types.includes('Files')) {
            return;
          }
          event.preventDefault();
          dragDepth.current += 1;
          setDragOver(true);
        }}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes('Files')) {
            return;
          }
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepth.current -= 1;
          if (dragDepth.current <= 0) {
            dragDepth.current = 0;
            setDragOver(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          dragDepth.current = 0;
          setDragOver(false);
          if (!active || editing) {
            return;
          }
          const files = [...event.dataTransfer.files];
          if (files.length) {
            void attachFiles(files);
          }
        }}
      >
        {dragOver && active && !editing ? (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-surface/90">
            <p className="rounded-md border border-dashed border-sage bg-sage-soft px-4 py-3 text-sm font-medium text-sage">
              Drop files to upload
            </p>
          </div>
        ) : null}
        {composerFiles.some((file) => !file.stored) && !dragOver ? (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-surface/70">
            <p className="flex items-center gap-2 rounded-md border border-line bg-surface px-4 py-3 text-sm font-medium text-ink">
              <Typing className="h-2.5 w-7 text-sage" aria-hidden />
              Uploading files…
            </p>
          </div>
        ) : null}
        {active ? (
          <>
            <header className="relative flex h-14 shrink-0 items-center gap-2 border-b border-line px-2 md:h-auto md:gap-3 md:px-6 md:py-4">
              <button
                type="button"
                className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center text-muted md:hidden"
                onClick={() => navigate('/chat')}
                aria-label={otherUnread > 0 ? `Back, ${otherUnread} unread` : 'Back'}
              >
                <ChevronLeft size={22} strokeWidth={1.75} />
                <CountBadge count={otherUnread} className="absolute top-0.5 right-0" />
              </button>
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                {dmPeer ? (
                  <Avatar
                    name={dmPeer.name}
                    src={dmPeer.avatar}
                    size={36}
                    status={avatarStatusFromPresence(
                      peerPresence(active, viewerId, presenceByUser),
                    )}
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {conversationTitle(active, viewerId)}
                  </p>
                  <p className="hidden text-xs text-muted md:block">
                    {active.type === CONVERSATION_TYPE.DIRECT
                      ? presenceLabel(peerPresence(active, viewerId, presenceByUser))
                      : `${active.members.length} members`}
                  </p>
                </div>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-2 pr-1">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 px-3 text-xs"
                  onClick={() => navigate(`/meetings?conversationId=${conversationId}`)}
                >
                  Create meeting
                </Button>
                {active.type !== CONVERSATION_TYPE.DIRECT ? (
                  <MemberStack members={active.members} />
                ) : null}
              </div>
            </header>
            <div
              ref={scroller}
              className="flex-1 overflow-y-auto px-4 py-6 scrollbar-none md:px-6"
            >
              {loadingMessages ? <ListLoading rows={4} className="px-4 py-3" /> : null}
              <div className="flex flex-col gap-8">
                {messageGroups.map((group) => {
                  const first = group[0]!;
                  const self = first.senderId === viewerId;
                  const senderName = first.senderName;
                  const senderAvatar =
                    first.senderAvatar ?? peopleById.get(first.senderId)?.avatar ?? null;
                  return (
                    <div
                      key={first.id}
                      className={cn('flex flex-col', self && 'items-end')}
                    >
                      <div
                        className={cn(
                          'mb-2 flex items-center gap-2',
                          self && 'flex-row-reverse',
                        )}
                      >
                        <Avatar name={senderName} src={senderAvatar} size={28} />
                        <p className="text-xs text-muted">{senderName}</p>
                      </div>
                      <BubbleGroup className={self ? 'items-end' : 'items-start'}>
                        {group.map((message) => (
                          <MessageBubble
                            key={message.id}
                            message={message}
                            self={self}
                            viewerId={viewerId}
                            people={peopleById}
                            parent={
                              message.replyToMessageId
                                ? messagesById.get(message.replyToMessageId)
                                : undefined
                            }
                            highlighted={highlightId === message.id}
                            receipt={
                              active
                                ? messageReceiptStatus(
                                    message,
                                    messages,
                                    active.members,
                                    viewerId,
                                  )
                                : null
                            }
                            onJumpToReply={jumpToMessage}
                            onOpenFile={setPreviewFile}
                            onReply={() => setReplyTo(message)}
                            onThread={() => setThread(message)}
                            onEdit={() => {
                              setEditing(message);
                              setDraft(message.content);
                            }}
                            onDelete={() =>
                              void deleteMessageRequest(message.id).then((updated) =>
                                setMessages((current) =>
                                  current.map((row) =>
                                    row.id === updated.id ? updated : row,
                                  ),
                                ),
                              )
                            }
                            onReact={(reaction) =>
                              void toggleReaction(
                                message,
                                viewerId,
                                reaction,
                                setMessages,
                              )
                            }
                          />
                        ))}
                      </BubbleGroup>
                    </div>
                  );
                })}
              </div>
            </div>
            {typingLabel ? (
              <div className="flex h-7 items-center gap-2 px-4 text-xs text-muted md:px-6">
                <Typing className="h-2.5 w-7 text-sage" aria-hidden />
                <p>{typingLabel}</p>
              </div>
            ) : null}
            {replyTo ? (
              <div className="flex items-center justify-between border-t border-line px-4 py-2 text-xs text-muted">
                Replying to {replyTo.senderName}
                <button type="button" onClick={() => setReplyTo(null)}>
                  Cancel
                </button>
              </div>
            ) : null}
            {editing ? (
              <div className="flex items-center justify-between px-4 py-2 text-xs text-muted">
                Editing message
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setDraft('');
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : null}
            {mentionOptions.length > 0 ? (
              <div className="border-t border-line bg-paper px-4 py-2">
                {mentionOptions.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-line/50"
                    onClick={() =>
                      insertMention(person.name.split(' ')[0] ?? person.name)
                    }
                  >
                    @{person.name}
                  </button>
                ))}
              </div>
            ) : null}
            <AIChatInput
              value={draft}
              onChange={onDraft}
              onSubmit={(event) => void submit(event)}
              onKeyDown={onComposerKey}
              onVoiceFile={(file) => sendVoiceNote(file)}
              canSubmit={
                Boolean(draft.trim() || composerFiles.some((file) => file.stored)) &&
                !composerFiles.some((file) => !file.stored)
              }
              uploading={voiceSending || composerFiles.some((file) => !file.stored)}
              preview={
                <ComposerFilePreview
                  files={composerFiles}
                  link={pendingLink}
                  linkLoading={linkLoading}
                  onRemove={(id) => {
                    setComposerFiles((current) => {
                      const next = current.filter((file) => file.id !== id);
                      const removed = current.find((file) => file.id === id);
                      if (removed) {
                        URL.revokeObjectURL(removed.previewUrl);
                      }
                      return next;
                    });
                  }}
                  onOpen={(file) => {
                    if (file.stored) {
                      setPreviewFile(file.stored);
                      return;
                    }
                    setPreviewFile({
                      url: file.previewUrl,
                      publicId: file.id,
                      bytes: 0,
                      contentType:
                        file.kind === 'image' ? 'image/jpeg' : 'application/octet-stream',
                      originalName: file.name,
                      kind: file.kind,
                    });
                  }}
                />
              }
              onAttachFiles={attachFiles}
              error={composerError}
            />
          </>
        ) : (
          <div className="hidden flex-1 items-center justify-center text-sm text-muted md:flex">
            {conversationId ? 'Opening conversation…' : 'Choose a conversation'}
          </div>
        )}
      </section>

      {thread ? (
        <aside className="hidden w-80 flex-col border-l border-line bg-paper lg:flex">
          <header className="flex items-center justify-between border-b border-line px-4 py-4">
            <p className="text-sm font-semibold">Thread</p>
            <button
              type="button"
              className="text-xs text-muted"
              onClick={() => setThread(null)}
            >
              Close
            </button>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto p-4 scrollbar-none">
            <div className="text-sm">
              <MessageText text={thread.content} />
              <MessageAttachments
                attachments={thread.attachments ?? []}
                onOpen={setPreviewFile}
                tone={thread.senderId === viewerId ? 'sent' : 'received'}
              />
              {(thread.linkPreviews ?? []).map((preview) => (
                <LinkPreviewCard key={preview.url} preview={preview} />
              ))}
            </div>
            {threadReplies.map((message) => (
              <div key={message.id} className="rounded-md bg-surface px-3 py-2 text-sm">
                <span className="block text-xs text-muted">{message.senderName}</span>
                <MessageText text={message.content} />
                <MessageAttachments
                  attachments={message.attachments ?? []}
                  onOpen={setPreviewFile}
                  tone={message.senderId === viewerId ? 'sent' : 'received'}
                />
                {(message.linkPreviews ?? []).map((preview) => (
                  <LinkPreviewCard key={preview.url} preview={preview} />
                ))}
              </div>
            ))}
          </div>
        </aside>
      ) : null}
      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
    </div>
  );
}

function MemberStack({ members }: { members: Conversation['members'] }) {
  const shown = members.slice(0, 3);
  const extra = members.length - shown.length;

  return (
    <div className="flex items-center" aria-label={`${members.length} members`}>
      {shown.map((member, index) => (
        <span
          key={member.id}
          className="relative"
          style={{ marginLeft: index === 0 ? 0 : -10, zIndex: shown.length - index }}
        >
          <Avatar
            name={member.user.name}
            src={member.user.avatar}
            size={28}
            className="border-surface ring-2 ring-surface"
          />
        </span>
      ))}
      {extra > 0 ? (
        <span
          className="relative inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-line bg-paper px-1 text-[10px] font-medium text-muted ring-2 ring-surface"
          style={{ marginLeft: -10, zIndex: 0 }}
        >
          +{extra}
        </span>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <p className="px-2 pb-2 text-[11px] font-medium tracking-wide text-muted uppercase">
        {title}
      </p>
      {children}
    </div>
  );
}

function ConversationButton({
  item,
  viewerId,
  presenceByUser,
  active,
  onClick,
}: {
  item: Conversation;
  viewerId: string;
  presenceByUser: Record<string, PresenceStatus>;
  active: boolean;
  onClick: () => void;
}) {
  const peer =
    item.type === CONVERSATION_TYPE.DIRECT
      ? (item.members.find((member) => member.userId !== viewerId)?.user ?? null)
      : null;
  const peerStatus = peer
    ? peerPresence(item, viewerId, presenceByUser)
    : PRESENCE_STATUS.OFFLINE;
  const subtitle = peer
    ? [peer.designation, conversationPreview(item)].filter(Boolean).join(' · ')
    : conversationPreview(item);

  return (
    <button
      className={cn(
        'mb-0.5 flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left',
        active ? 'bg-sage-soft' : 'hover:bg-line/50',
      )}
      onClick={onClick}
    >
      {peer ? (
        <Avatar
          name={peer.name}
          src={peer.avatar}
          size={36}
          status={avatarStatusFromPresence(peerStatus)}
        />
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {conversationTitle(item, viewerId)}
        </span>
        <span className="block truncate text-xs text-muted">{subtitle}</span>
      </span>
      {item.unreadCount > 0 ? (
        <span className="rounded-full bg-sage px-1.5 text-[10px] font-medium text-surface">
          {item.unreadCount}
        </span>
      ) : null}
    </button>
  );
}

function MessageBubble({
  message,
  self,
  viewerId,
  people,
  parent,
  onReply,
  onThread,
  onEdit,
  onDelete,
  onReact,
  onOpenFile,
  highlighted,
  onJumpToReply,
  receipt,
}: {
  message: Message;
  self: boolean;
  viewerId: string;
  people: Map<string, PublicUser>;
  parent?: Message;
  onReply: () => void;
  onThread: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReact: (reaction: string) => void;
  onOpenFile: (file: StoredFile) => void;
  highlighted?: boolean;
  onJumpToReply: (messageId: string) => void;
  receipt?: ReturnType<typeof messageReceiptStatus>;
}) {
  const deleted = Boolean(message.deletedAt);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [peopleReaction, setPeopleReaction] = useState<string | undefined>(undefined);
  const visibleReactions = message.reactions.slice(0, 3);
  const extraReactions = message.reactions.length - visibleReactions.length;

  // Reserve room for time + ticks and the floating reaction pill on short bubbles.
  const metaMinWidth = 28 /* bubble pad */ + 52 /* time */ + (self && receipt ? 22 : 0);
  const reactionMinWidth =
    visibleReactions.length > 0
      ? 16 /* pill pad */ +
        visibleReactions.length * 18 +
        (extraReactions > 0 ? 18 : 0) +
        8
      : 0;
  const bubbleMinWidth = Math.max(metaMinWidth, reactionMinWidth);

  function openPeople(reaction?: string) {
    setPeopleReaction(reaction);
    setPeopleOpen(true);
  }

  const replyImage = (message.replyTo?.attachments ?? parent?.attachments ?? []).find(
    (file) => file.kind === 'image',
  );
  const audioFiles = (message.attachments ?? []).filter((file) => file.kind === 'audio');
  const otherFiles = (message.attachments ?? []).filter((file) => file.kind !== 'audio');
  const voiceOnly =
    !deleted &&
    !message.content &&
    audioFiles.length > 0 &&
    otherFiles.length === 0 &&
    !message.replyTo;
  const showTextBubble =
    deleted ||
    Boolean(message.content.trim()) ||
    Boolean(message.replyTo) ||
    audioFiles.length > 0;
  const showMeeting = !deleted && Boolean(message.meeting);
  const showMedia =
    !deleted && (otherFiles.length > 0 || (message.linkPreviews ?? []).length > 0);
  const actionsVisible = pickerOpen || peopleOpen;

  return (
    <div
      id={`message-${message.id}`}
      className={cn(
        'group/msg flex w-fit max-w-[80%] flex-col rounded-md',
        self && 'self-end items-end',
        highlighted && 'ring-2 ring-sage ring-offset-2 ring-offset-surface',
      )}
    >
      {showTextBubble ? (
        <Bubble
          variant={self && !deleted ? 'default' : 'muted'}
          align={self ? 'end' : 'start'}
          className={cn('max-w-full', deleted && 'opacity-80')}
        >
          <div
            className={cn('relative max-w-full', message.reactions.length > 0 && 'mb-3')}
            style={{ minWidth: bubbleMinWidth }}
          >
            <BubbleContent
              className={cn(
                'w-full',
                self && !deleted ? 'bg-sage text-surface' : 'bg-paper text-ink',
                voiceOnly && self && 'rounded-full bg-sage px-2.5 py-1.5 text-surface',
                voiceOnly && !self && 'rounded-full bg-sage-soft px-2.5 py-1.5 text-sage',
                deleted && 'bg-paper italic text-muted',
              )}
              style={{ minWidth: bubbleMinWidth }}
            >
              {message.replyTo ? (
                <button
                  type="button"
                  className="mb-1 flex max-w-full items-center gap-2 rounded-md bg-black/10 px-1.5 py-1 text-left"
                  onClick={() => {
                    if (message.replyToMessageId) {
                      onJumpToReply(message.replyToMessageId);
                    }
                  }}
                >
                  {replyImage ? (
                    <img
                      src={replyImage.url}
                      alt=""
                      className="size-10 shrink-0 rounded object-cover"
                    />
                  ) : null}
                  <span className="min-w-0 truncate text-[11px] opacity-80">
                    ↳ {message.replyTo.content}
                  </span>
                </button>
              ) : null}
              {message.content ? (
                <MessageText text={message.content} inverted={self && !deleted} />
              ) : null}
              {message.editedAt && !deleted ? (
                <span className="ml-1 text-[10px] opacity-80">(edited)</span>
              ) : null}
              {!deleted
                ? audioFiles.map((file) => (
                    <VoiceNotePlayer
                      key={file.publicId}
                      file={file}
                      tone={self ? 'sent' : 'received'}
                    />
                  ))
                : null}
              {self && receipt ? (
                <span className="mt-1 flex min-h-[14px] w-full min-w-[4.75rem] shrink-0 items-center justify-end gap-1">
                  <span
                    className={cn(
                      'inline-block min-w-[2.75rem] text-right font-mono text-[10px] tabular-nums',
                      self && !deleted ? 'text-surface/75' : 'text-muted',
                    )}
                  >
                    {new Intl.DateTimeFormat('en-IN', {
                      hour: 'numeric',
                      minute: '2-digit',
                    }).format(new Date(message.createdAt))}
                  </span>
                  <MessageReceiptTicks
                    status={receipt}
                    inverted={self && !deleted}
                    className="w-3.5 shrink-0"
                  />
                </span>
              ) : !self ? (
                <span className="mt-1 flex min-h-[14px] w-full min-w-[2.75rem] shrink-0 justify-end">
                  <span className="inline-block min-w-[2.75rem] text-right font-mono text-[10px] tabular-nums text-muted">
                    {new Intl.DateTimeFormat('en-IN', {
                      hour: 'numeric',
                      minute: '2-digit',
                    }).format(new Date(message.createdAt))}
                  </span>
                </span>
              ) : null}
            </BubbleContent>
            {message.reactions.length > 0 ? (
              <>
                <BubbleReactions
                  role="button"
                  aria-label="Who reacted"
                  align="end"
                  className="cursor-pointer"
                  onClick={() => openPeople()}
                >
                  {visibleReactions.map((reaction) => (
                    <button
                      key={reaction.reaction}
                      type="button"
                      className="inline-flex size-4 items-center justify-center rounded-full"
                      onClick={(event) => {
                        event.stopPropagation();
                        openPeople(reaction.reaction);
                      }}
                    >
                      <AnimatedEmoji emoji={reaction.reaction} size={14} />
                    </button>
                  ))}
                  {extraReactions > 0 ? (
                    <span className="pl-0.5 text-[10px] text-muted">
                      +{extraReactions}
                    </span>
                  ) : null}
                </BubbleReactions>
                <ReactionPeopleModal
                  open={peopleOpen}
                  reactions={message.reactions}
                  people={people}
                  viewerId={viewerId}
                  initialReaction={peopleReaction}
                  onClose={() => setPeopleOpen(false)}
                  onToggle={onReact}
                />
              </>
            ) : null}
          </div>
        </Bubble>
      ) : null}
      {showMeeting && message.meeting ? (
        <div
          className={cn(
            'w-full min-w-[220px] max-w-sm rounded-md border border-line bg-paper p-3',
            showTextBubble && 'mt-2',
          )}
        >
          <div className="flex items-start gap-2.5">
            <GoogleMeetIcon size={20} className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{message.meeting.title}</p>
              <p className="mt-1 font-mono text-xs text-muted">
                {new Intl.DateTimeFormat('en-IN', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                }).format(new Date(message.meeting.startTime))}
              </p>
            </div>
          </div>
          <a
            href={message.meeting.googleMeetUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex h-9 items-center gap-2 rounded-md border border-line px-3 text-xs font-medium hover:bg-line/40"
          >
            <GoogleMeetIcon size={16} />
            Join Google Meet
          </a>
        </div>
      ) : null}
      {showMedia ? (
        <div
          className={cn(
            'relative w-full min-w-[220px] max-w-sm',
            showTextBubble && 'mt-2',
            message.reactions.length > 0 && !showTextBubble && 'mb-3',
          )}
        >
          <MessageAttachments
            attachments={otherFiles}
            onOpen={onOpenFile}
            includeAudio={false}
          />
          {(message.linkPreviews ?? []).map((preview) => (
            <LinkPreviewCard key={preview.url} preview={preview} />
          ))}
          {self && receipt && !showTextBubble ? (
            <span className="mt-1 flex items-center justify-end gap-1 px-1">
              <span className="font-mono text-[10px] text-muted">
                {new Intl.DateTimeFormat('en-IN', {
                  hour: 'numeric',
                  minute: '2-digit',
                }).format(new Date(message.createdAt))}
              </span>
              <MessageReceiptTicks status={receipt} />
            </span>
          ) : null}
          {message.reactions.length > 0 && !showTextBubble ? (
            <>
              <BubbleReactions
                role="button"
                aria-label="Who reacted"
                align="end"
                className="cursor-pointer"
                onClick={() => openPeople()}
              >
                {visibleReactions.map((reaction) => (
                  <button
                    key={reaction.reaction}
                    type="button"
                    className="inline-flex size-4 items-center justify-center rounded-full"
                    onClick={(event) => {
                      event.stopPropagation();
                      openPeople(reaction.reaction);
                    }}
                  >
                    <AnimatedEmoji emoji={reaction.reaction} size={14} />
                  </button>
                ))}
                {extraReactions > 0 ? (
                  <span className="pl-0.5 text-[10px] text-muted">+{extraReactions}</span>
                ) : null}
              </BubbleReactions>
              <ReactionPeopleModal
                open={peopleOpen}
                reactions={message.reactions}
                people={people}
                viewerId={viewerId}
                initialReaction={peopleReaction}
                onClose={() => setPeopleOpen(false)}
                onToggle={onReact}
              />
            </>
          ) : null}
        </div>
      ) : null}
      {!deleted ? (
        <div
          className={cn(
            'mt-1 flex flex-wrap items-center gap-0.5 text-muted',
            'md:pointer-events-none md:opacity-0 md:group-hover/msg:pointer-events-auto md:group-hover/msg:opacity-100 md:group-focus-within/msg:pointer-events-auto md:group-focus-within/msg:opacity-100',
            actionsVisible && 'md:pointer-events-auto md:opacity-100',
          )}
        >
          <button
            type="button"
            title="Reply"
            className="rounded-md p-1.5 hover:bg-line/50 hover:text-ink"
            onClick={onReply}
          >
            <Reply size={14} strokeWidth={1.75} />
          </button>
          {message.replyCount > 0 ? (
            <button
              type="button"
              className="rounded-md px-1.5 py-1 text-[11px] hover:bg-line/50 hover:text-ink"
              onClick={onThread}
            >
              ↳ {message.replyCount}
            </button>
          ) : null}
          {self ? (
            <>
              <button
                type="button"
                title="Edit"
                className="rounded-md p-1.5 hover:bg-line/50 hover:text-ink"
                onClick={onEdit}
              >
                <Pencil size={14} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                title="Delete"
                className="rounded-md p-1.5 hover:bg-line/50 hover:text-ink"
                onClick={onDelete}
              >
                <Trash2 size={14} strokeWidth={1.75} />
              </button>
            </>
          ) : null}
          <EmojiPickerShell
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            onPick={onReact}
          >
            <button
              type="button"
              title="React"
              className="rounded-md p-1.5 hover:bg-line/50 hover:text-ink"
              onClick={() => setPickerOpen((open) => !open)}
            >
              <SmilePlus size={14} strokeWidth={1.75} />
            </button>
          </EmojiPickerShell>
        </div>
      ) : null}
    </div>
  );
}

function peerPresence(
  conversation: Conversation,
  viewerId: string,
  presenceByUser: Record<string, PresenceStatus>,
): PresenceStatus {
  const other = conversation.members.find((member) => member.userId !== viewerId);
  if (!other) {
    return PRESENCE_STATUS.OFFLINE;
  }
  const known = presenceByUser[other.userId];
  if (known) {
    return known;
  }
  if ((conversation.onlineUserIds ?? []).includes(other.userId)) {
    return PRESENCE_STATUS.ONLINE;
  }
  return PRESENCE_STATUS.OFFLINE;
}

async function toggleReaction(
  message: Message,
  viewerId: string,
  reaction: string,
  setMessages: Dispatch<SetStateAction<Message[]>>,
) {
  const mine = message.reactions.some(
    (row) => row.reaction === reaction && row.userIds.includes(viewerId),
  );
  const optimistic = withReaction(message, viewerId, reaction, !mine);
  setMessages((current) =>
    current.map((row) => (row.id === message.id ? optimistic : row)),
  );
  try {
    const updated = mine
      ? await removeReactionRequest(message.id, reaction)
      : await addReactionRequest(message.id, reaction);
    setMessages((current) =>
      current.map((row) => (row.id === updated.id ? mergeMessage(row, updated) : row)),
    );
  } catch {
    setMessages((current) =>
      current.map((row) => (row.id === message.id ? message : row)),
    );
  }
}
