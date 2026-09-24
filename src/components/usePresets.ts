import { useEffect, useState } from 'react';
import type { Preset } from '@/core/presets';
import { watchPresets } from '@/storage/read';

/** The installed presets, kept current. Null until they have loaded. */
export function usePresets(): readonly Preset[] | null {
  const [presets, setPresets] = useState<readonly Preset[] | null>(null);
  useEffect(() => {
    const watcher = watchPresets(setPresets);
    return () => {
      watcher.stop();
    };
  }, []);
  return presets;
}
