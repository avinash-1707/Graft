import { z } from 'zod';

export const transportSchema = z.enum(['SSE', 'WEBSOCKET']);

export type Transport = z.infer<typeof transportSchema>;
export const Transport = transportSchema.enum;

export const TRANSPORTS = transportSchema.options;
