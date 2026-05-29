import { tool, type ToolSet } from 'ai';
import { z } from 'zod';

/**
 * Model-invoked escalation. The model calls this tool mid-turn when it judges it
 * cannot help the customer from the knowledge base and a human should take over.
 * The tool has NO `execute`, so the call is reported back to the caller as a
 * tool-call (surfaced via the stream's `toolCalls`) and generation stops after it.
 * ai-service (unit 17) evaluates the call as the `MODEL_INVOKED` escalation
 * trigger — this package only defines the tool, it does not act on it.
 */
export const ESCALATE_TOOL_NAME = 'escalate';

export const escalateToolInputSchema = z.object({
  reason: z.string().min(1).describe('Brief reason a human agent is needed.'),
});

export type EscalateToolInput = z.infer<typeof escalateToolInputSchema>;

export const escalateTool = tool({
  description:
    'Escalate to a human agent. Call this only when the knowledge base does not ' +
    'contain the information needed to help the customer, or the request is beyond ' +
    'what you can resolve. Do not call it for questions you can answer from the ' +
    'provided context.',
  inputSchema: escalateToolInputSchema,
});

/**
 * The default tool set passed to chat generation for grounded support turns.
 * The cast bridges a known AI SDK ⇄ `exactOptionalPropertyTypes` friction: a
 * no-`execute` tool's inferred type does not structurally match the `ToolSet`
 * index-signature union. The runtime value is a valid tool set.
 */
export const chatTools = { escalate: escalateTool } as unknown as ToolSet;
