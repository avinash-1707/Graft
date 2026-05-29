import { z } from 'zod';

export const widgetLauncherPositionSchema = z.enum(['BOTTOM_RIGHT', 'BOTTOM_LEFT']);

export type WidgetLauncherPosition = z.infer<typeof widgetLauncherPositionSchema>;
export const WidgetLauncherPosition = widgetLauncherPositionSchema.enum;

export const WIDGET_LAUNCHER_POSITIONS = widgetLauncherPositionSchema.options;
