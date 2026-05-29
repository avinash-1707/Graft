import { defineConfig } from 'drizzle-kit';

const url = process.env['DATABASE_URL'] ?? 'postgres://placeholder/placeholder';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  strict: true,
  verbose: true,
  dbCredentials: { url },
});
