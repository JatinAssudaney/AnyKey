import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';
import { APP_DESCRIPTION, APP_NAME, APP_SHORT_NAME } from './src/core/app';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  // Explicit imports everywhere: easier to read, lint and grep than auto-imports.
  imports: false,
  modules: ['@wxt-dev/module-react', '@wxt-dev/auto-icons'],
  autoIcons: {
    baseIconPath: 'assets/icon.svg',
    developmentIndicator: 'overlay',
  },
  manifest: {
    name: APP_NAME,
    short_name: APP_SHORT_NAME,
    description: APP_DESCRIPTION,
    permissions: ['storage'],
  },
  // Branded Chrome no longer loads unpacked extensions from the command line, so load .output/ by hand.
  webExt: { disabled: true },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
