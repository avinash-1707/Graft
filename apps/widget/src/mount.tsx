import { createRoot } from 'react-dom/client';
import styleText from './styles.css?inline';
import { resolveBootConfig, type WidgetBootOptions } from './config';
import { widgetThemeVars } from './theme';
import { WidgetApp } from './components/WidgetApp';

const HOST_ELEMENT_ID = 'graft-widget-host';

export interface WidgetHandle {
  unmount(): void;
}

/**
 * Mounts the widget into a Shadow DOM attached to a single host element on the
 * page. All styles live inside the shadow root (injected from the bundled
 * stylesheet), so nothing leaks to or from the host page. Tenant theme tokens
 * are set as inherited custom properties on the host element. Idempotent: a
 * second call is a no-op while a widget is already mounted.
 */
export function mount(options?: WidgetBootOptions): WidgetHandle {
  const existing = document.getElementById(HOST_ELEMENT_ID);
  if (existing) {
    return { unmount: () => existing.remove() };
  }

  const config = resolveBootConfig(options);

  const host = document.createElement('div');
  host.id = HOST_ELEMENT_ID;
  for (const [token, value] of Object.entries(widgetThemeVars(config.appearance))) {
    host.style.setProperty(token, value);
  }

  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = styleText;
  shadow.appendChild(style);

  const mountNode = document.createElement('div');
  shadow.appendChild(mountNode);

  document.body.appendChild(host);

  const root = createRoot(mountNode);
  root.render(<WidgetApp config={config} />);

  return {
    unmount: () => {
      root.unmount();
      host.remove();
    },
  };
}
