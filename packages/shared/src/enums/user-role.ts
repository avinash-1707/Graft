import { z } from 'zod';

export const userRoleSchema = z.enum(['OWNER', 'CUSTOMER_SUPPORT_AGENT']);

export type UserRole = z.infer<typeof userRoleSchema>;
export const UserRole = userRoleSchema.enum;

export const USER_ROLES = userRoleSchema.options;
