import { z } from 'zod';
import { sessionIdSchema } from './ids.js';

/**
 * Widget session bootstrap. The widget sends its stored session UUID (if any);
 * the gateway validates it belongs to the resolved org and returns a usable id,
 * minting a new one when absent or not recognized.
 */
export const widgetSessionRequestSchema = z.object({
  sessionId: sessionIdSchema.optional(),
});
export type WidgetSessionRequest = z.infer<typeof widgetSessionRequestSchema>;

export const widgetSessionResponseSchema = z.object({
  sessionId: sessionIdSchema,
});
export type WidgetSessionResponse = z.infer<typeof widgetSessionResponseSchema>;
