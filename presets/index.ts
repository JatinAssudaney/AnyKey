// Every preset in this folder, found at build time: a new site's preset is one more JSON file, with no code to change.
// `pnpm lint:presets` checks that each file is named after its preset's id.
const files = import.meta.glob<unknown>('./*.json', { eager: true, import: 'default' });

/** The bundled presets as raw data, sorted by file name (so by id) to keep their order the same from build to build. */
export const BUNDLED_PRESETS: readonly unknown[] = Object.keys(files)
  .sort()
  .map((file) => files[file]);
