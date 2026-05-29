import { jwtClaimsSchema, type AuthUser, type JwtClaims } from '@graft/shared';
import { SignJWT, jwtVerify } from 'jose';

export interface JwtConfig {
  secret: string;
  issuer: string;
  accessTtlSeconds: number;
}

export interface SignedToken {
  token: string;
  /** Unix epoch seconds at which the token expires. */
  expiresAt: number;
}

const ALG = 'HS256';

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/** Signs an access token whose claims identify the user, org, and role. */
export async function signAccessToken(user: AuthUser, config: JwtConfig): Promise<SignedToken> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresAt = nowSeconds + config.accessTtlSeconds;
  const claims: JwtClaims = {
    sub: user.id,
    org: user.organizationId,
    role: user.role,
    email: user.email,
  };
  const token = await new SignJWT({ org: claims.org, role: claims.role, email: claims.email })
    .setProtectedHeader({ alg: ALG })
    .setSubject(claims.sub)
    .setIssuer(config.issuer)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(expiresAt)
    .sign(secretKey(config.secret));
  return { token, expiresAt };
}

/** Verifies signature + claims and returns the typed payload, or throws on failure. */
export async function verifyAccessToken(token: string, config: JwtConfig): Promise<JwtClaims> {
  const { payload } = await jwtVerify(token, secretKey(config.secret), {
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
