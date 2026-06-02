import { z } from 'zod';
import { widgetPresetSchema } from '../enums/widget-preset.js';
import { widgetLauncherPositionSchema } from '../enums/widget-launcher-position.js';
import { DEFAULT_WIDGET_BOT_NAME, DEFAULT_WIDGET_GREETING } from '../constants.js';

/** A CSS hex color: `#rgb`, `#rrggbb`, or `#rrggbbaa`. Stored/echoed verbatim. */
export const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, 'Must be a hex color like #4F46E5');

/**
 * Tenant widget appearance. A full-document upsert: the owner PUTs the complete
 * config and the gateway replaces the stored row. Colors theme the customer
 * widget; bot name + greeting are customer-facing copy.
 */
export const widgetConfigSchema = z.object({
  accentPrimary: hexColorSchema,
  bgSurface: hexColorSchema,
  textPrimary: hexColorSchema,
  textMuted: hexColorSchema,
  botName: z.string().trim().min(1).max(60),
  greeting: z.string().trim().min(1).max(280),
  preset: widgetPresetSchema,
  launcherPosition: widgetLauncherPositionSchema,
});
export type WidgetConfig = z.infer<typeof widgetConfigSchema>;

/** Effective config returned when a tenant has not customized the widget yet. */
export const DEFAULT_WIDGET_CONFIG: WidgetConfig = {
  accentPrimary: '#4F46E5',
  bgSurface: '#FFFFFF',
  textPrimary: '#0F1115',
  textMuted: '#6B7280',
  botName: DEFAULT_WIDGET_BOT_NAME,
  greeting: DEFAULT_WIDGET_GREETING,
  preset: 'LIGHT',
  launcherPosition: 'BOTTOM_RIGHT',
};
