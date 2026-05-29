import { z } from 'zod';

export const widgetPresetSchema = z.enum(['LIGHT', 'DARK', 'BRAND']);

export type WidgetPreset = z.infer<typeof widgetPresetSchema>;
export const WidgetPreset = widgetPresetSchema.enum;

export const WIDGET_PRESETS = widgetPresetSchema.options;
