import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    // Pure logic runs in Node; DOM tests opt in per file with `// @vitest-environment happy-dom`.
    environment: 'node',
    restoreMocks: true,
  },
});
