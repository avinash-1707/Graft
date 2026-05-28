import { z } from 'zod';

export const uuidSchema = z.uuid();

export const organizationIdSchema = uuidSchema.brand<'OrganizationId'>();
export type OrganizationId = z.infer<typeof organizationIdSchema>;

export const conversationIdSchema = uuidSchema.brand<'ConversationId'>();
export type ConversationId = z.infer<typeof conversationIdSchema>;

export const messageIdSchema = uuidSchema.brand<'MessageId'>();
export type MessageId = z.infer<typeof messageIdSchema>;

export const sessionIdSchema = uuidSchema.brand<'SessionId'>();
export type SessionId = z.infer<typeof sessionIdSchema>;

export const agentIdSchema = uuidSchema.brand<'AgentId'>();
export type AgentId = z.infer<typeof agentIdSchema>;

export const noteIdSchema = uuidSchema.brand<'NoteId'>();
export type NoteId = z.infer<typeof noteIdSchema>;
