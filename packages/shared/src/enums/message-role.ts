import { z } from 'zod';

export const messageRoleSchema = z.enum(['CUSTOMER', 'AI', 'AGENT', 'SYSTEM']);

export type MessageRole = z.infer<typeof messageRoleSchema>;
export const MessageRole = messageRoleSchema.enum;

export const MESSAGE_ROLES = messageRoleSchema.options;
