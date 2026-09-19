import { z } from 'zod';
import { CHANNEL_VISIBILITY, CONVERSATION_TYPE, DEPARTMENTS, DESIGNATIONS, ROLE_VALUES, SALES_VISIT_KIND } from '../constants/index';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const submitDailyWorkSchema = z.object({
  content: z.string(),
});

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  designation: z.enum(DESIGNATIONS),
  department: z.enum(DEPARTMENTS),
  role: z.enum(ROLE_VALUES),
  avatar: z.string().url().nullable().optional(),
  managerId: z.string().uuid().nullable().optional(),
  headedDepartments: z.array(z.enum(DEPARTMENTS)).optional(),
  extraDesignations: z.array(z.enum(DESIGNATIONS)).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  designation: z.enum(DESIGNATIONS).optional(),
  department: z.enum(DEPARTMENTS).optional(),
  role: z.enum(ROLE_VALUES).optional(),
  avatar: z.string().url().nullable().optional(),
  managerId: z.string().uuid().nullable().optional(),
  headedDepartments: z.array(z.enum(DEPARTMENTS)).optional(),
  extraDesignations: z.array(z.enum(DESIGNATIONS)).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const meetingAttachmentSchema = z.object({
  kind: z.literal('meeting'),
  meetingId: z.string().uuid(),
  title: z.string().min(1).max(120),
  startTime: z.string(),
  endTime: z.string(),
  googleMeetUrl: z.string().url(),
});

export const createMeetingSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    participantUserIds: z.array(z.string().uuid()).optional(),
    participantIds: z.array(z.string().uuid()).optional(),
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    conversationId: z.string().uuid().nullable().optional(),
  })
  .transform((value) => {
    const participantUserIds = [...new Set([...(value.participantUserIds ?? []), ...(value.participantIds ?? [])])];
    return {
      title: value.title,
      participantUserIds,
      startTime: value.startTime,
      endTime: value.endTime,
      conversationId: value.conversationId ?? null,
    };
  })
  .refine((value) => value.participantUserIds.length > 0, {
    message: 'Invite at least one participant.',
    path: ['participantUserIds'],
  })
  .refine((value) => value.endTime > value.startTime, {
    message: 'Meeting end must be after start.',
    path: ['endTime'],
  });

export const storedFileSchema = z.object({
  url: z.string().url(),
  publicId: z.string().min(1),
  bytes: z.number().int().nonnegative(),
  contentType: z.string().min(1),
  originalName: z.string().min(1).max(180),
  kind: z.enum(['image', 'pdf', 'spreadsheet', 'audio', 'file']),
  previewRows: z.array(z.array(z.string())).max(16).optional(),
});

export const linkPreviewSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1).max(200),
  description: z.string().max(400).default(''),
  image: z.string().nullable(),
  siteName: z.string().min(1).max(120),
});

export const linkPreviewRequestSchema = z.object({
  url: z.string().url(),
});

export const createMessageSchema = z
  .object({
    content: z.string().trim().max(4000).default(''),
    attachments: z.array(storedFileSchema).max(8).optional(),
    linkPreviews: z.array(linkPreviewSchema).max(3).optional(),
    replyToMessageId: z.string().uuid().nullable().optional(),
  })
  .refine((value) => value.content.length > 0 || (value.attachments?.length ?? 0) > 0, {
    message: 'Write a message or attach a file.',
    path: ['content'],
  });

export const updateMessageSchema = z.object({
  content: z.string().trim().min(1).max(4000),
});

export const messageReactionSchema = z.object({
  reaction: z.string().trim().min(1).max(32),
});

export const createConversationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(CONVERSATION_TYPE.DIRECT),
    userId: z.string().uuid(),
  }),
  z.object({
    type: z.literal(CONVERSATION_TYPE.GROUP),
    name: z.string().trim().min(2).max(80),
    visibility: z.enum([CHANNEL_VISIBILITY.PUBLIC, CHANNEL_VISIBILITY.PRIVATE]).default(CHANNEL_VISIBILITY.PRIVATE),
    memberIds: z.array(z.string().uuid()).optional().default([]),
    department: z.enum(DEPARTMENTS).nullable().optional(),
  }),
  z.object({
    type: z.literal(CONVERSATION_TYPE.CHANNEL),
    name: z.string().trim().min(2).max(80),
    visibility: z.enum([CHANNEL_VISIBILITY.PUBLIC, CHANNEL_VISIBILITY.PRIVATE]),
    memberIds: z.array(z.string().uuid()).optional(),
    department: z.enum(DEPARTMENTS).nullable().optional(),
  }),
]).superRefine((value, ctx) => {
  if (value.type === CONVERSATION_TYPE.DIRECT) {
    return;
  }
  if (value.visibility === CHANNEL_VISIBILITY.PRIVATE && (value.memberIds?.length ?? 0) < 1) {
    ctx.addIssue({ code: 'custom', message: 'Invite at least one person.', path: ['memberIds'] });
  }
});

export const addConversationMemberSchema = z.object({
  userId: z.string().uuid(),
});

const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, 'Use 24-hour time as HH:MM.')
  .transform((value) => value.slice(0, 5));

export const updateDailyWorkWindowSchema = z
  .object({
    startTime: timeOfDaySchema,
    endTime: timeOfDaySchema,
    minCharacters: z.number().int().min(1).max(5000),
    maxCharacters: z.number().int().min(1).max(20000),
    allowLateSubmission: z.boolean(),
    reminderEnabled: z.boolean(),
    reminderTime: timeOfDaySchema,
    timezone: z.string().trim().min(3).max(64),
  })
  .refine((value) => value.startTime < value.endTime, {
    message: 'Submission start must be before end.',
    path: ['endTime'],
  })
  .refine((value) => value.minCharacters < value.maxCharacters, {
    message: 'Minimum characters must be below the maximum.',
    path: ['maxCharacters'],
  });

export const salesVisitItemSchema = z.object({
  shopId: z.string().trim().max(32).nullable().optional(),
  shopName: z.string().trim().min(1).max(120),
  place: z.string().trim().max(120).optional().default(''),
  kind: z.enum([SALES_VISIT_KIND.INSTALLATION, SALES_VISIT_KIND.DEMO, SALES_VISIT_KIND.VISIT]),
  count: z.coerce.number().int().min(0).max(99),
  notes: z.string().max(4000),
});

export const salesReceivedItemSchema = z.object({
  shopId: z.string().trim().max(200).nullable().optional(),
  shopName: z.string().trim().min(1).max(120),
  place: z.string().trim().max(120).optional().default(''),
  amount: z.coerce.number().min(0),
  gst: z.enum(['GST', 'Non-GST']),
  ref: z.string().trim().max(80).optional().default(''),
  mode: z.enum(['Cash', 'Cheque', 'UPI']),
  bankName: z.string().trim().max(80).optional().default(''),
  month: z.string().trim().min(3).max(12).optional(),
  year: z.coerce.number().int().min(2020).max(2100).optional(),
  sheetRow: z.coerce.number().int().min(2).max(20000).optional(),
});

export const salesDaySchema = z.object({
  visits: z.array(salesVisitItemSchema),
  received: z.array(salesReceivedItemSchema),
  fuel: z.coerce.number().min(0).optional().default(0),
});

export const salesDaySaveSchema = z
  .object({
    section: z.enum(['visit', 'received', 'fuel']),
    visit: salesVisitItemSchema.optional(),
    received: salesReceivedItemSchema.optional(),
    fuel: z.coerce.number().min(0).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.section === 'visit' && !value.visit) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Add a shop visit.' });
    }
    if (value.section === 'received' && !value.received) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Add a received payment.' });
    }
    if (value.section === 'fuel' && value.fuel === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Add fuel.' });
    }
  });

export const salesShopSchema = z.object({
  shopId: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(120),
  place: z.string().trim().max(120).optional().default(''),
});

export const salesShopBulkSchema = z.object({
  shops: z.array(salesShopSchema).min(1).max(2000),
  confirm: z.boolean().optional().default(true),
  csv: z.string().optional(),
});

export const salesPaymentPatchSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100).optional(),
  month: z.string().trim().min(3).max(12),
  shopId: z.string().trim().min(1).max(200),
  sheetRow: z.coerce.number().int().min(2).max(20000).optional(),
  status: z.string().trim().max(40),
  paymentMode: z.string().trim().max(40),
  date: z.string().trim().max(32).optional().default(''),
  reference: z.string().trim().max(80).optional().default(''),
});
export type LoginInput = z.infer<typeof loginSchema>;
export type SalesDayInput = z.infer<typeof salesDaySchema>;
export type SalesDaySaveInput = z.infer<typeof salesDaySaveSchema>;
export type SalesShopInput = z.infer<typeof salesShopSchema>;
export type SalesShopBulkInput = z.infer<typeof salesShopBulkSchema>;
export type SalesPaymentPatchInput = z.infer<typeof salesPaymentPatchSchema>;
export type SubmitDailyWorkInput = z.infer<typeof submitDailyWorkSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;
export type MeetingAttachmentInput = z.infer<typeof meetingAttachmentSchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type StoredFileInput = z.infer<typeof storedFileSchema>;
export type UpdateMessageInput = z.infer<typeof updateMessageSchema>;
export type MessageReactionInput = z.infer<typeof messageReactionSchema>;
export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type AddConversationMemberInput = z.infer<typeof addConversationMemberSchema>;
export type UpdateDailyWorkWindowInput = z.infer<typeof updateDailyWorkWindowSchema>;
