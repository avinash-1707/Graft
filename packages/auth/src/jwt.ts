import { jwtClaimsSchema, type JwtClaims } from '@graft/shared';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface JwtVerifierConfig {
  /** Better Auth JWKS endpoint, e.g. `${gatewayUrl}/api/auth/jwks`. */
  jwksUrl: string;
  /** Expected `iss` — Better Auth uses its base URL. */
  issuer: string;
  /** Expected `aud` — Better Auth uses its base URL. */
  audience: string;
}

export type JwtVerifier = (token: string) => Promise<JwtClaims>;

/**
 * Builds a verifier for gateway-issued (Better Auth) JWTs. Keys are fetched from
 * the gateway's JWKS endpoint and cached by `jose` (asymmetric EdDSA — no shared
 * secret). The gateway is the only signer; every internal service verifies with this
 * one path. Returns the typed claims, or throws on signature/issuer/audience/expiry
 * or a claims-shape mismatch.
 */
export function createJwtVerifier(config: JwtVerifierConfig): JwtVerifier {
  const jwks = createRemoteJWKSet(new URL(config.jwksUrl));
  return async (token: string): Promise<JwtClaims> => {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: config.issuer,
      audience: config.audience,
    });
    return jwtClaimsSchema.parse({
      sub: payload.sub,
      org: payload['org'],
      role: payload['role'],
      email: payload['email'],
    });
  };
}
