import { z } from 'zod';

/**
 * A canonical web origin: scheme + host + optional port, no path/query/hash.
 * e.g. `https://acme.com`, `http://localhost:3000`. Rejects anything that does
 * not round-trip to its own origin so the allow-list stays unambiguous.
 */
export const originSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(253 + 8)
  .refine((value) => {
    try {
      const u = new URL(value);
      return (
        (u.protocol === 'http:' || u.protocol === 'https:') && `${u.protocol}//${u.host}` === value
      );
    } catch {
      return false;
    }
  }, 'Must be a valid origin like https://example.com (no path)');

export const addAllowedOriginRequestSchema = z.object({
  origin: originSchema,
});
export type AddAllowedOriginRequest = z.infer<typeof addAllowedOriginRequestSchema>;

export const allowedOriginSchema = z.object({
  id: z.uuid(),
  origin: z.string(),
  createdAt: z.string(),
});
export type AllowedOrigin = z.infer<typeof allowedOriginSchema>;

export const embedTokenResponseSchema = z.object({
  embedToken: z.string(),
});
export type EmbedTokenResponse = z.infer<typeof embedTokenResponseSchema>;
