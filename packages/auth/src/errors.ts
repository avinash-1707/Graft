/**
 * Authentication/authorization error carrying a stable machine code + HTTP status;
 * the message is safe to return to clients. Designed to flow through each service's
 * global Fastify error handler, which reads `error.code` and `error.statusCode` and
 * never leaks internals. Shared so every internal service (and the widget edge)
 * reports the same auth contract.
 */
export class AuthError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export const AuthErrors = {
  unauthorized: (): AuthError => new AuthError('UNAUTHORIZED', 401, 'Authentication required.'),
  forbidden: (): AuthError =>
    new AuthError('FORBIDDEN', 403, 'You do not have access to this resource.'),
  invalidEmbedToken: (): AuthError =>
    new AuthError('INVALID_EMBED_TOKEN', 401, 'Invalid or missing embed token.'),
  originNotAllowed: (): AuthError =>
    new AuthError('ORIGIN_NOT_ALLOWED', 403, 'This origin is not allowed for the widget.'),
} as const;
