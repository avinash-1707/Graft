import { z } from 'zod';

export const authCodePurposeSchema = z.enum(['EMAIL_VERIFICATION', 'PASSWORD_RESET']);

export type AuthCodePurpose = z.infer<typeof authCodePurposeSchema>;
export const AuthCodePurpose = authCodePurposeSchema.enum;

export const AUTH_CODE_PURPOSES = authCodePurposeSchema.options;
