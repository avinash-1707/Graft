import type { WidgetConfig } from '@graft/shared';

/**
 * Maps the tenant's customizable appearance subset onto the widget's CSS custom
 * properties. These are applied as inline styles on the Shadow DOM host element;
 * because custom properties are inherited, they cascade across the shadow
 * boundary and override the `:host` defaults in styles.css. Only the documented
 * overridable tokens are emitted (ui-context.md §Widget Customization) — preset
 * and the named copy strings are handled elsewhere.
 */
export function widgetThemeVars(config: WidgetConfig): Record<string, string> {
  return {
    '--graft-accent-primary': config.accentPrimary,
    '--graft-bg-surface': config.bgSurface,
    '--graft-text-primary': config.textPrimary,
    '--graft-text-muted': config.textMuted,
  };
}
