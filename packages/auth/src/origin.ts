/**
 * Normalizes an `Origin` (or a `Referer` fallback) header value to a canonical
 * origin string `scheme://host[:port]`, lowercased, with no path/query/hash.
 * Returns undefined for missing or unparseable values. The result is compared
 * against the org's registered allow-list, so it must match the stored form
 * produced by `originSchema` in `@graft/shared`.
 */
export function normalizeOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.toLowerCase() === 'null') return undefined;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined;
    return `${u.protocol}//${u.host}`.toLowerCase();
  } catch {
    return undefined;
  }
}
