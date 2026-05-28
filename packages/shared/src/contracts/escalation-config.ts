import { z } from 'zod';

export const groundingThresholdSchema = z.number().min(0).max(1);

export const escalationConfigSchema = z.object({
  thirdHumanRequestEnabled: z.boolean(),
  weakGroundingEnabled: z.boolean(),
  weakGroundingThreshold: groundingThresholdSchema,
  modelInvokedEnabled: z.boolean(),
  negativeSentimentEnabled: z.boolean(),
  providerFailureEnabled: z.boolean(),
});

export type EscalationConfig = z.infer<typeof escalationConfigSchema>;
