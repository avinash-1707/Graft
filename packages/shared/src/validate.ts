import type { ZodType } from 'zod';

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

/**
 * Validate a payload against a Zod contract, returning either the parsed data or a
 * flat `{ field: message }` map for inline display. Lives in `@graft/shared` so every
 * client (web auth pages, dashboard) validates with the same contracts the gateway
 * enforces — and so `zod` stays a single dependency of this package.
 */
export function validate<T>(
  schema: ZodType<T>,
  input: unknown,
): { ok: true; data: T } | { ok: false; errors: FieldErrors<T> } {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };

  const errors: FieldErrors<T> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !(key in errors)) {
      (errors as Record<string, string>)[key] = issue.message;
    }
  }
  return { ok: false, errors };
}
