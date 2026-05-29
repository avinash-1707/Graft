import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

export type Database = ReturnType<typeof drizzle<typeof schema>>;

export interface CreateDbOptions {
  connectionString: string;
  max?: number;
  idleTimeout?: number;
  connectTimeout?: number;
}

export function createDb(options: CreateDbOptions): { db: Database; close: () => Promise<void> } {
  const client = postgres(options.connectionString, {
    max: options.max ?? 10,
    idle_timeout: options.idleTimeout ?? 30,
    connect_timeout: options.connectTimeout ?? 10,
    prepare: false,
  });
  const db = drizzle(client, { schema });
  return {
    db,
    close: () => client.end({ timeout: 5 }),
  };
}
