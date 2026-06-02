import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * The widget ships as a single self-contained IIFE bundle dropped onto any
 * tenant site. All CSS is bundled into the JS (it is injected into the Shadow
 * DOM at runtime via a `?inline` import), so the build emits no separate
 * stylesheet — one `<script src="widget.js">` tag is the entire embed.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    cssCodeSplit: false,
    lib: {
      entry: resolve(import.meta.dirname, 'src/embed.ts'),
      name: 'GraftWidget',
      formats: ['iife'],
      fileName: () => 'widget.js',
    },
    // `cssCodeSplit: false` + the single IIFE lib entry already emit one file;
    // no manual chunk config needed.
  },
});
