/**
 * Domain error for the auth flows. Carries a stable machine code and an HTTP
 * status; the message is safe to return to clients. Generic-by-design where
 * leaking specifics would aid enumeration (e.g. INVALID_CREDENTIALS).
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
  emailInUse: () => new AuthError('EMAIL_IN_USE', 409, 'An account with this email already exists.'),
  invalidCredentials: () =>
    new AuthError('INVALID_CREDENTIALS', 401, 'Invalid email or password.'),
  emailNotVerified: () =>
    new AuthError('EMAIL_NOT_VERIFIED', 403, 'Verify your email before signing in.'),
  invalidCode: () => new AuthError('INVALID_CODE', 400, 'The code is invalid or has expired.'),
  alreadyVerified: () => new AuthError('ALREADY_VERIFIED', 409, 'Email is already verified.'),
  unauthorized: () => new AuthError('UNAUTHORIZED', 401, 'Authentication required.'),
  forbidden: () => new AuthError('FORBIDDEN', 403, 'You do not have access to this resource.'),
  agentNotFound: () => new AuthError('AGENT_NOT_FOUND', 404, 'Agent not found.'),
} as const;

/** Public-widget validation errors. Reuse {@link AuthError}'s code+status contract. */
export const WidgetErrors = {
  invalidEmbedToken: () =>
    new AuthError('INVALID_EMBED_TOKEN', 401, 'Invalid or missing embed token.'),
  originNotAllowed: () =>
    new AuthError('ORIGIN_NOT_ALLOWED', 403, 'This origin is not allowed for this widget.'),
} as const;
