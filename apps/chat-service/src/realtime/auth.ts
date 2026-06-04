import { normalizeOrigin, type JwtVerifier } from '@graft/auth';
import {
  findOrganizationByEmbedToken,
  findSessionForOrg,
  isOriginAllowed,
  type Database,
} from '@graft/db';
import type { Socket } from 'socket.io';

type Handshake = Socket['handshake'];

/** The authenticated identity attached to a connected socket (`socket.data.identity`). */
export type ChatIdentity =
  | { kind: 'AGENT'; organizationId: string; agentId: string }
  | { kind: 'CUSTOMER'; organizationId: string; sessionId: string };

export interface SocketAuthDeps {
  db: Database;
  verifier: JwtVerifier;
}

/** Thrown to reject a handshake; the message is not surfaced to the client verbatim. */
export class SocketAuthError extends Error {}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Authenticates a Socket.IO handshake into a {@link ChatIdentity}. Two participant
 * kinds (architecture.md §Auth):
 * - AGENT: a gateway-signed JWT in `auth.token` → org + agentId.
 * - CUSTOMER: the public embed token + session id in `auth`, gated by the org's
 *   Origin allow-list (the real boundary) and a tenant-scoped session check.
 * Throws {@link SocketAuthError} on any failure; the connection is refused.
 */
export async function authenticateSocket(
  handshake: Handshake,
  deps: SocketAuthDeps,
): Promise<ChatIdentity> {
  const auth = handshake.auth as Record<string, unknown>;

  const token = str(auth.token);
  if (token) {
    try {
      const claims = await deps.verifier(token);
      return { kind: 'AGENT', organizationId: claims.org, agentId: claims.sub };
    } catch {
      throw new SocketAuthError('invalid token');
    }
  }

  const embedToken = str(auth.embedToken);
  const sessionId = str(auth.sessionId);
  if (embedToken && sessionId) {
    const org = await findOrganizationByEmbedToken(deps.db, embedToken);
    if (!org) throw new SocketAuthError('invalid embed token');

    const origin =
      normalizeOrigin(str(handshake.headers.origin)) ??
      normalizeOrigin(str(handshake.headers.referer));
    if (!origin || !(await isOriginAllowed(deps.db, org.id, origin))) {
      throw new SocketAuthError('origin not allowed');
    }

    const session = await findSessionForOrg(deps.db, sessionId, org.id);
    if (!session) throw new SocketAuthError('invalid session');

    return { kind: 'CUSTOMER', organizationId: org.id, sessionId: session.id };
  }

  throw new SocketAuthError('unauthorized');
}
