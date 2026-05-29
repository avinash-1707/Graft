import type { FastifyReply } from 'fastify';
import type { z } from 'zod';

/**
 * Parses input against a Zod schema. On failure, sends a 400 in the gateway's
 * stable error shape and returns undefined so the caller can `return` early.
 */
export function parseOr400<T extends z.ZodType>(
  schema: T,
  input: unknown,
  reply: FastifyReply,
): z.infer<T> | undefined {
  const result = schema.safeParse(input);
  if (!result.success) {
    reply.code(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request.',
        details: result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
    });
    return undefined;
  }
  return result.data;
}
