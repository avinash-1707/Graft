import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

/** Generates a zero-padded numeric one-time code of the given length. */
export function generateOtp(length: number): string {
  const max = 10 ** length;
  return randomInt(0, max).toString().padStart(length, '0');
}

/** SHA-256 hex of the code. OTPs are short-lived and single-use; we store only the hash. */
export function hashOtp(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

export function verifyOtp(code: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashOtp(code), 'hex');
  const expected = Buffer.from(storedHash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
