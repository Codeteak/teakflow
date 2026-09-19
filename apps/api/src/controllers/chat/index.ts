import type { NextFunction, Request, Response } from 'express';
import {
  addConversationMember,
  addReaction,
  createConversation,
  createMessage,
  deleteChannel,
  deleteMessage,
  getConversation,
  listConversations,
  listManagedChannels,
  listMessages,
  markRead,
  removeConversationMember,
  removeReaction,
  searchMessages,
  unreadTotal,
  updateMessage,
} from '../../services/chat/index';

function param(req: Request, key: string) {
  const value = req.params[key];
  return Array.isArray(value) ? value[0]! : value!;
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await listConversations(req.userId!, req.user!.role) });
  } catch (error) {
    next(error);
  }
}

export async function listManaged(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await listManagedChannels(req.userId!, req.user!.role) });
  } catch (error) {
    next(error);
  }
}

export async function unread(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: { unreadTotal: await unreadTotal(req.userId!) } });
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const conversation = await createConversation(req.userId!, req.user!.role, req.body);
    res.status(201).json({ data: conversation });
  } catch (error) {
    next(error);
  }
}

export async function show(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      data: await getConversation(req.userId!, param(req, 'id'), req.user!.role),
    });
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      data: await deleteChannel(req.userId!, req.user!.role, param(req, 'id')),
    });
  } catch (error) {
    next(error);
  }
}

export async function addMember(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      data: await addConversationMember(
        req.userId!,
        req.user!.role,
        param(req, 'id'),
        req.body.userId,
      ),
    });
  } catch (error) {
    next(error);
  }
}

export async function removeMember(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      data: await removeConversationMember(
        req.userId!,
        req.user!.role,
        param(req, 'id'),
        param(req, 'userId'),
      ),
    });
  } catch (error) {
    next(error);
  }
}

export async function messages(req: Request, res: Response, next: NextFunction) {
  try {
    const thread = typeof req.query.thread === 'string' ? req.query.thread : undefined;
    res.json({
      data: await listMessages(req.userId!, param(req, 'id'), thread, req.user!.role),
    });
  } catch (error) {
    next(error);
  }
}

export async function postMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const message = await createMessage(
      req.userId!,
      param(req, 'id'),
      req.body.content ?? '',
      req.body.replyToMessageId,
      {
        senderName: req.user?.name,
        senderAvatar: req.user?.avatar ?? null,
        attachments: req.body.attachments,
        linkPreviews: req.body.linkPreviews,
      },
    );
    res.status(201).json({ data: message });
  } catch (error) {
    next(error);
  }
}

export async function search(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      data: await searchMessages(req.userId!, {
        q: typeof req.query.q === 'string' ? req.query.q : undefined,
        senderId: typeof req.query.senderId === 'string' ? req.query.senderId : undefined,
        conversationId:
          typeof req.query.conversationId === 'string'
            ? req.query.conversationId
            : undefined,
        from: typeof req.query.from === 'string' ? req.query.from : undefined,
        to: typeof req.query.to === 'string' ? req.query.to : undefined,
      }),
    });
  } catch (error) {
    next(error);
  }
}

export async function patchMessage(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      data: await updateMessage(req.userId!, param(req, 'id'), req.body.content),
    });
  } catch (error) {
    next(error);
  }
}

export async function destroyMessage(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await deleteMessage(req.userId!, param(req, 'id')) });
  } catch (error) {
    next(error);
  }
}

export async function react(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      data: await addReaction(req.userId!, param(req, 'id'), req.body.reaction),
    });
  } catch (error) {
    next(error);
  }
}

export async function unreact(req: Request, res: Response, next: NextFunction) {
  try {
    const reaction = typeof req.query.reaction === 'string' ? req.query.reaction : '';
    res.json({ data: await removeReaction(req.userId!, param(req, 'id'), reaction) });
  } catch (error) {
    next(error);
  }
}

export async function read(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await markRead(req.userId!, param(req, 'id')) });
  } catch (error) {
    next(error);
  }
}
