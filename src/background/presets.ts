import { browser } from 'wxt/browser';
import github from '../../presets/github.json';
import reddit from '../../presets/reddit.json';
import youtube from '../../presets/youtube.json';
import { parsePresets, PRESETS_KEY, type Preset } from '../core/presets';

/**
 * Where presets come from. Every other context reads the installed presets from chrome.storage.local, so another
 * source (such as a remote list of preset data) plugs in here without changes elsewhere.
 */
export interface PresetSource {
  /** Every preset the source has, as raw data: each is checked before it is installed. */
  load(): Promise<readonly unknown[]>;
}

/** The presets in `presets/`, bundled with the extension. */
export const bundledPresets: PresetSource = {
  load: () => Promise.resolve([github, youtube, reddit]),
};

/**
 * Installs the presets from every source in chrome.storage.local: for each id, the highest version a source has.
 * A preset that fails its checks is left out. Storage is written only when the presets changed, since every open
 * tab resolves its shortcuts again when they do.
 */
export async function installPresets(sources: readonly PresetSource[] = [bundledPresets]): Promise<void> {
  const newest = new Map<string, Preset>();
  for (const raw of (await Promise.all(sources.map((source) => source.load()))).flat()) {
    const [preset] = parsePresets([raw]);
    if (preset === undefined) {
      console.error('AnyKey: a preset failed its checks and was left out.', raw);
      continue;
    }
    const current = newest.get(preset.id);
    if (current === undefined || preset.version > current.version) newest.set(preset.id, preset);
  }
  const presets = [...newest.values()];
  const { [PRESETS_KEY]: stored } = await browser.storage.local.get(PRESETS_KEY);
  if (JSON.stringify(stored) !== JSON.stringify(presets)) await browser.storage.local.set({ [PRESETS_KEY]: presets });
}
