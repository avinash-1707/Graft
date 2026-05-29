import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { widgetLauncherPositionPgEnum, widgetPresetPgEnum } from './enums.js';

export const widgetConfigs = pgTable('widget_configs', {
  organizationId: uuid('organization_id')
    .primaryKey()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  accentPrimary: text('accent_primary').notNull(),
  bgSurface: text('bg_surface').notNull(),
  textPrimary: text('text_primary').notNull(),
  textMuted: text('text_muted').notNull(),
  botName: text('bot_name').notNull(),
  greeting: text('greeting').notNull(),
  preset: widgetPresetPgEnum('preset').notNull(),
  launcherPosition: widgetLauncherPositionPgEnum('launcher_position').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
