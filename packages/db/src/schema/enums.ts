import { pgEnum } from 'drizzle-orm/pg-core';
import {
  AI_INFERENCE_STATUSES,
  AI_PROVIDERS,
  CONVERSATION_STATES,
  ESCALATION_TRIGGERS,
  MESSAGE_ROLES,
  USER_ROLES,
  type AiInferenceStatus,
  type AiProvider,
  type ConversationState,
  type EscalationTrigger,
  type MessageRole,
  type UserRole,
} from '@graft/shared';

const asTuple = <T extends string>(arr: readonly T[]): [T, ...T[]] => arr as unknown as [T, ...T[]];

export const conversationStatePgEnum = pgEnum(
  'conversation_state',
  asTuple<ConversationState>(CONVERSATION_STATES),
);
export const messageRolePgEnum = pgEnum('message_role', asTuple<MessageRole>(MESSAGE_ROLES));
export const userRolePgEnum = pgEnum('user_role', asTuple<UserRole>(USER_ROLES));
export const aiProviderPgEnum = pgEnum('ai_provider', asTuple<AiProvider>(AI_PROVIDERS));
export const escalationTriggerPgEnum = pgEnum(
  'escalation_trigger',
  asTuple<EscalationTrigger>(ESCALATION_TRIGGERS),
);
export const aiInferenceStatusPgEnum = pgEnum(
  'ai_inference_status',
  asTuple<AiInferenceStatus>(AI_INFERENCE_STATUSES),
);

export const kbDocumentTypePgEnum = pgEnum('kb_document_type', ['PDF', 'DOCX', 'TEXT']);
export const kbDocumentStatusPgEnum = pgEnum('kb_document_status', [
  'PENDING',
  'PROCESSING',
  'READY',
  'FAILED',
]);
export const widgetPresetPgEnum = pgEnum('widget_preset', ['LIGHT', 'DARK', 'BRAND']);
export const widgetLauncherPositionPgEnum = pgEnum('widget_launcher_position', [
  'BOTTOM_RIGHT',
  'BOTTOM_LEFT',
]);
