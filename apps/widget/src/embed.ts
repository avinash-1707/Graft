import { mount, type WidgetHandle } from './mount';
import type { WidgetBootOptions } from './config';

/**
 * Embed entrypoint. Built as a single self-contained IIFE: dropping
 * `<script src="widget.js">` onto a tenant page auto-mounts the widget using
 * `window.__GRAFT_WIDGET__` for config. The `GraftWidget.mount()` API is also
 * exposed for hosts that prefer to mount programmatically.
 */
const api = {
  mount: (options?: WidgetBootOptions): WidgetHandle => mount(options),
};

declare global {
  interface Window {
    GraftWidget?: typeof api;
  }
}

function autoMount(): void {
  mount();
}

if (typeof window !== 'undefined') {
  window.GraftWidget = api;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMount, { once: true });
  } else {
    autoMount();
  }
}

export { mount };
export type { WidgetBootOptions, WidgetHandle };
