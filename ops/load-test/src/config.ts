/**
 * Load-test configuration, all from env so the harness can point at the compose
 * stack (defaults) or any deployment. The realtime flows need a *seeded* tenant —
 * see ops/README.md (embed token + allow-listed origin + agent JWTs).
 */
function num(name: string, def: number): number {
  const v = process.env[name];
  return v ? Number(v) : def;
}

function list(name: string, def: string): string[] {
  return (process.env[name] ?? def)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const strip = (u: string): string => u.replace(/\/+$/, '');

export const config = {
  /** Gateway (public ingress) — mints widget sessions. */
  gatewayUrl: strip(process.env.GATEWAY_URL ?? 'http://localhost:8080'),
  /** ai-service behind the nginx pool — the widget SSE turn endpoint. */
  aiUrl: strip(process.env.AI_URL ?? 'http://localhost:8090'),
  /** chat-service behind the nginx (sticky) pool — agent WS. */
  chatUrl: strip(process.env.CHAT_URL ?? 'http://localhost:8091'),
  /** Direct per-instance chat URLs for the cross-instance fan-out scenario. */
  chatInstanceUrls: list('CHAT_INSTANCE_URLS', 'http://localhost:8101,http://localhost:8102').map(strip),
  /** Public embed token of the seeded tenant (from the dashboard org settings). */
  embedToken: process.env.EMBED_TOKEN ?? '',
  /** An origin on the tenant's allow-list (sent as the Origin header). */
  origin: process.env.ORIGIN ?? 'http://localhost:3000',
  /** Comma-separated agent JWTs (minted via the gateway `/api/auth/token`). */
  agentTokens: list('AGENT_TOKENS', ''),
  durationMs: num('DURATION_MS', 30_000),
};

export function requireEmbedToken(): void {
  if (!config.embedToken) throw new Error('EMBED_TOKEN is required (the tenant embed token).');
}

export function requireAgentTokens(min: number): void {
  if (config.agentTokens.length < min) {
    throw new Error(`need at least ${min} comma-separated AGENT_TOKENS (agent JWTs).`);
  }
}
