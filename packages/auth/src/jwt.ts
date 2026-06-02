import { jwtClaimsSchema, type JwtClaims } from '@graft/shared';
import { jwtVerify } from 'jose';

export interface JwtVerifyConfig {
  secret: string;
  issuer: string;
}

const ALG = 'HS256';

/**
 * Verifies a gateway-issued access token (HS256, shared secret + issuer) and
 * returns the typed claims. The gateway is the only signer; internal services only
 * verify. Throws on signature/issuer/expiry/claims failure.
 */
export async function verifyAccessToken(
  token: string,
  config: JwtVerifyConfig,
): Promise<JwtClaims> {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(config.secret), {
    issuer: config.issuer,
    algorithms: [ALG],
  });
  return jwtClaimsSchema.parse({
    sub: payload.sub,
    org: payload['org'],
    role: payload['role'],
    email: payload['email'],
  });
}
