import type { JwtClaims } from '@graft/shared';
import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
  preHandlerHookHandler,
} from 'fastify';
import fp from 'fastify-plugin';
import { AuthErrors } from './errors.js';
import type { JwtVerifier } from './jwt.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by the `authenticate` preHandler once a valid bearer token is verified. */
    authUser?: JwtClaims;
  }
  interface FastifyInstance {
    /** preHandler: verifies the bearer token and attaches `request.authUser`. */
    authenticate: preHandlerHookHandler;
    /** Builds a preHandler enforcing a role; run it after `authenticate`. */
    requireRole: (role: JwtClaims['role']) => preHandlerHookHandler;
  }
}

export interface JwtAuthPluginOptions {
  /** Verifier built from {@link createJwtVerifier} (JWKS-backed). */
  verifier: JwtVerifier;
}

function bearerToken(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  if (!header) return undefined;
  const [scheme, value] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !value) return undefined;
  return value;
}

/**
 * Decorates `authenticate` (verify bearer JWT via JWKS → `request.authUser`) and
 * `requireRole`. Shared across internal services so the verify path is defined once.
 * Throws {@link AuthError} on failure, which each service's error handler maps to the
 * stable `{ error: { code, message } }` shape.
 */
const jwtAuthPlugin: FastifyPluginAsync<JwtAuthPluginOptions> = async (app, opts) => {
  app.decorateRequest('authUser', undefined);

  app.decorate('authenticate', async (request: FastifyRequest) => {
    const token = bearerToken(request);
    if (!token) throw AuthErrors.unauthorized();
    try {
      request.authUser = await opts.verifier(token);
    } catch {
      throw AuthErrors.unauthorized();
    }
  });

  app.decorate('requireRole', (role: JwtClaims['role']): preHandlerHookHandler => {
    return async (request: FastifyRequest, _reply: FastifyReply) => {
      if (!request.authUser) throw AuthErrors.unauthorized();
      if (request.authUser.role !== role) throw AuthErrors.forbidden();
    };
  });
};

export default fp(jwtAuthPlugin, { name: 'graft-jwt-auth' });
