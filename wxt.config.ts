import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';
import { APP_DESCRIPTION, APP_NAME } from './src/core/app';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  // WXT's default, .output, is hidden in Finder and the "Load unpacked" picker on macOS.
  outDir: 'dist',
  // Explicit imports everywhere: easier to read, lint and grep than auto-imports.
  imports: false,
  modules: ['@wxt-dev/module-react', '@wxt-dev/auto-icons'],
  autoIcons: {
    baseIconPath: 'assets/icon.svg',
    developmentIndicator: 'overlay',
  },
  manifest: {
    name: APP_NAME,
    description: APP_DESCRIPTION,
    permissions: ['storage'],
    // A key for the popup, which works in every tab, even where the content script can't run. The browser gives it
    // the key only when nothing else has that key, and people change it on the browser's extension shortcuts page.
    commands: {
      _execute_action: { suggested_key: { default: 'Alt+Shift+K' } },
    },
  },
  // Branded Chrome no longer loads unpacked extensions from the command line, so load dist/ by hand.
  webExt: { disabled: true },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
