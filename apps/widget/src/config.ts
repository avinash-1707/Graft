import { DEFAULT_WIDGET_CONFIG, widgetConfigSchema, type WidgetConfig } from '@graft/shared';

/**
 * Bootstrap config read from the host page. The embed script sets a global
 * `window.__GRAFT_WIDGET__` (or passes options to `mount()` directly) carrying
 * the public embed token, the API base URL, and an optional appearance override
 * for local preview. The token/base URL are not used by the shell (unit 21) —
 * they are validated and stored for the network units (22/23).
 */
export interface WidgetBootOptions {
  /** Public per-org embed token (lives in host page source; tenant identity, not a secret). */
  readonly embedToken?: string;
  /** Gateway base URL the widget talks to. Defaults to the script's own origin later. */
  readonly apiBaseUrl?: string;
  /** Optional appearance override (server-fetched in unit 22; inline here for preview). */
  readonly appearance?: Partial<WidgetConfig>;
}

export interface ResolvedWidgetConfig {
  readonly embedToken: string | undefined;
  readonly apiBaseUrl: string | undefined;
  readonly appearance: WidgetConfig;
}

declare global {
  interface Window {
    __GRAFT_WIDGET__?: WidgetBootOptions;
  }
}

/**
 * Resolves the effective config: explicit `mount()` options win over the global,
 * appearance overrides are validated against the shared schema and merged onto
 * the defaults (a bad override falls back to defaults rather than breaking the
 * embed).
 */
export function resolveBootConfig(options?: WidgetBootOptions): ResolvedWidgetConfig {
  const boot: WidgetBootOptions = {
    ...(typeof window !== 'undefined' ? window.__GRAFT_WIDGET__ : undefined),
    ...options,
  };

  const parsed = widgetConfigSchema.safeParse({
    ...DEFAULT_WIDGET_CONFIG,
    ...boot.appearance,
  });

  return {
    embedToken: boot.embedToken,
    apiBaseUrl: boot.apiBaseUrl,
    appearance: parsed.success ? parsed.data : DEFAULT_WIDGET_CONFIG,
  };
}
