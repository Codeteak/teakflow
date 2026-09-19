import {
  addConversationMemberSchema,
  createConversationSchema,
  createMessageSchema,
  messageReactionSchema,
  ROLES,
  updateMessageSchema,
} from '@teakflow/shared';
import { Router } from 'express';
import {
  addMember,
  create,
  destroyMessage,
  list,
  listManaged,
  messages,
  patchMessage,
  postMessage,
  react,
  read,
  remove,
  removeMember,
  search,
  show,
  unreact,
  unread,
} from '../controllers/chat/index';
import { requireAuth } from '../middlewares/auth/index';
import { requireRole } from '../middlewares/authorization/index';
import { validateBody } from '../middlewares/validation/index';

export const conversationsRouter = Router();
export const messagesRouter = Router();

conversationsRouter.use(requireAuth);
conversationsRouter.get('/', list);
conversationsRouter.get('/unread-total', unread);
conversationsRouter.get('/managed-channels', requireRole(ROLES.ADMIN), listManaged);
conversationsRouter.post('/', validateBody(createConversationSchema), create);
conversationsRouter.get('/search', search);
conversationsRouter.get('/:id', show);
conversationsRouter.delete('/:id', requireRole(ROLES.ADMIN), remove);
conversationsRouter.post('/:id/members', validateBody(addConversationMemberSchema), addMember);
conversationsRouter.delete('/:id/members/:userId', removeMember);
conversationsRouter.get('/:id/messages', messages);
conversationsRouter.post('/:id/messages', validateBody(createMessageSchema), postMessage);

messagesRouter.use(requireAuth);
messagesRouter.patch('/:id', validateBody(updateMessageSchema), patchMessage);
messagesRouter.delete('/:id', destroyMessage);
messagesRouter.post('/:id/reactions', validateBody(messageReactionSchema), react);
messagesRouter.delete('/:id/reactions', unreact);
messagesRouter.post('/:id/read', read);
