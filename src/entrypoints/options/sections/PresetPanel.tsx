import { useId } from 'react';
import { Chevron } from '@/components/Chevron';
import { focusAfterRender } from '@/components/focus';
import { KeyCaps } from '@/components/KeyCaps';
import { checkbox, focusRing, hintText, linkButton, secondaryButton } from '@/components/styles';
import type { Conflict } from '@/core/conflicts';
import type { SyncData } from '@/core/docs';
import type { Mutation } from '@/core/messages';
import { presetOverride, type Preset } from '@/core/presets';
import { presetYields, type NativeKey, type SiteShortcuts } from '@/core/resolve';
import type { Shortcut } from '@/core/schema';
import type { Editing } from './ShortcutDialog';
import { editButtonId, ShortcutTable } from './ShortcutTable';

const summaryClass = `flex w-fit cursor-pointer list-none items-center gap-2 rounded text-sm font-semibold ${focusRing}`;

interface PresetPanelProps {
  preset: Preset;
  host: string;
  data: SyncData;
  /** The whole site, from `shortcutsOnSite`. */
  site: SiteShortcuts;
  /** Conflicts among the site's shortcuts and with its own keys. */
  conflicts: ReadonlyMap<string, readonly Conflict[]>;
  send: (mutation: Mutation) => void;
  onEdit: (editing: Editing) => void;
  /** Asks before resetting the site to the preset. */
  onReset: () => void;
}

/**
 * A preset on one of its sites: its shortcuts with the user's changes, the built-in shortcuts that give way to the
 * site's own keys (each with a switch to keep it on the site), and a reference of the site's keys. The last two can
 * run long (GitHub has dozens of keys), so they start closed.
 */
export function PresetPanel({ preset, host, data, site, conflicts, send, onEdit, onReset }: PresetPanelProps) {
  const ids = useId();
  const { state } = data;
  const siteState = state.sites.get(host);
  const overrides = state.presets.get(preset.id);
  const bases = new Map(preset.shortcuts.map((shortcut) => [shortcut.id, shortcut]));
  const shortcuts = site.shortcuts.filter(({ id }) => bases.has(id));
  const yields = presetYields(state, preset, siteState);
  const native = site.native.filter((key) => key.site === preset.name);
  // The shortcuts that take each of the site's keys, so the site's own shortcut doesn't run.
  const takers = new Map<NativeKey, Shortcut[]>();
  for (const shortcut of site.shortcuts) {
    for (const conflict of conflicts.get(shortcut.id) ?? []) {
      if (conflict.kind === 'takesNative') takers.set(conflict.native, [...(takers.get(conflict.native) ?? []), shortcut]);
    }
  }
  const changed =
    overrides !== undefined || (siteState?.globals.size ?? 0) > 0 || (siteState?.shortcuts.length ?? 0) > 0;
  const headingId = `${ids}-heading`;

  return (
    <section aria-labelledby={headingId} className="mt-8">
      <h4 id={headingId} className="text-sm font-semibold">
        {preset.name} preset
      </h4>
      <p className={hintText}>
        Shortcuts AnyKey adds on {preset.name}. Your changes to them stay when AnyKey updates the preset. Those marked
        Unverified haven&apos;t been tried on the live site yet: if one can&apos;t find what it clicks, AnyKey says so
        on the page.
      </p>
      <ShortcutTable
        caption={`${preset.name} preset shortcuts`}
        hideCaption
        shortcuts={shortcuts}
        conflicts={conflicts}
        describe
        onToggle={(shortcut, enabled) => {
          const base = bases.get(shortcut.id);
          if (base === undefined) return;
          const override = presetOverride(base, overrides?.get(shortcut.id), { enabled });
          send({ op: 'setPresetOverride', preset: preset.id, id: shortcut.id, override });
        }}
        onEdit={(shortcut) => {
          const base = bases.get(shortcut.id);
          if (base !== undefined) onEdit({ kind: 'preset', shortcut, base, preset, site: host });
        }}
        extra={(shortcut) =>
          overrides?.has(shortcut.id) === true ? (
            <button
              type="button"
              onClick={() => {
                send({ op: 'setPresetOverride', preset: preset.id, id: shortcut.id, override: {} });
                // The Reset button goes away with the change, so focus moves to the row's Edit button.
                focusAfterRender(() => document.getElementById(editButtonId(shortcut)));
              }}
              className={linkButton}
            >
              Reset<span className="sr-only"> {shortcut.label}</span>
            </button>
          ) : null
        }
      />

      {yields.length > 0 && (
        <details className="group mt-6">
          <summary className={summaryClass}>
            <Chevron className="group-open:rotate-90" />
            Built-in shortcuts that give way to {preset.name}
            <Count n={yields.length} />
          </summary>
          <p className={hintText}>
            Where {preset.name} uses one of these keys itself, AnyKey leaves the key to {preset.name}. Keep a shortcut
            to have AnyKey&apos;s run there instead.
          </p>
          <ul className="mt-3 space-y-3">
            {yields.map(({ shortcut, native: key }) => {
              const kept = siteState?.globals.get(shortcut.id) === true;
              const noteId = `${ids}-${shortcut.id}-note`;
              return (
                <li key={shortcut.id}>
                  <label className="flex flex-wrap items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      role="switch"
                      checked={kept}
                      aria-describedby={noteId}
                      onChange={(event) => {
                        send({
                          op: 'setSiteDefault',
                          site: host,
                          id: shortcut.id,
                          ...(event.target.checked ? { enabled: true } : {}),
                        });
                      }}
                      className={checkbox}
                    />
                    Keep &quot;{shortcut.label}&quot;
                    <KeyCaps keys={shortcut.keys} mode={shortcut.keyMode} />
                  </label>
                  <p id={noteId} className={`${hintText} ml-6`}>
                    {kept
                      ? `AnyKey keeps the keys on ${host}, so ${preset.name}'s own "${key.label}" doesn't run.`
                      : `${preset.name}'s own "${key.label}" gets the keys where it works.`}
                  </p>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      <details className={`group ${yields.length > 0 ? 'mt-4' : 'mt-6'}`}>
        <summary className={summaryClass}>
          <Chevron className="group-open:rotate-90" />
          {preset.name}&apos;s own keys
          <Count n={native.length} />
        </summary>
        <p className={hintText}>
          What {preset.name} does with its keys, as far as AnyKey knows. AnyKey passes them to {preset.name}, except
          those a shortcut here takes.
        </p>
        <table className="mt-3 w-full table-fixed border-collapse text-left text-sm">
          <caption className="sr-only">{preset.name}&apos;s own keys</caption>
          <thead>
            <tr className="border-b border-stone-200 text-xs text-stone-600 dark:border-stone-700 dark:text-stone-400">
              <th scope="col" className="w-40 py-2 pr-4 font-medium">
                Keys
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                What it does
              </th>
              <th scope="col" className="w-44 py-2 font-medium">
                Pages
              </th>
            </tr>
          </thead>
          <tbody>
            {native.map((key, i) => (
              <tr key={i} className="border-b border-stone-100 align-top last:border-0 dark:border-stone-800">
                <td className="py-2 pr-4">
                  <KeyCaps keys={key.keys} mode="key" />
                </td>
                <th scope="row" className="py-2 pr-4 font-normal">
                  {key.label}
                  {(takers.get(key) ?? []).map((shortcut) => (
                    <span key={shortcut.id} className="block text-xs text-amber-800 dark:text-amber-300">
                      Doesn&apos;t run: &quot;{shortcut.label}&quot; takes its keys.
                    </span>
                  ))}
                </th>
                <td className="py-2 text-xs break-words text-stone-600 dark:text-stone-400">
                  <Pages matches={key.matches} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      {changed && (
        <button type="button" onClick={onReset} className={`${secondaryButton} mt-6`}>
          Reset to the {preset.name} preset
        </button>
      )}
    </section>
  );
}

/** How many entries a collapsed list holds, next to its summary. */
function Count({ n }: { n: number }) {
  return (
    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700 dark:bg-stone-800 dark:text-stone-300">
      {n}
    </span>
  );
}

/** Where a site key works: every page, or the path part of each of its match patterns (what follows the host). */
function Pages({ matches }: { matches: readonly string[] | undefined }) {
  if (matches === undefined) return 'Every page';
  return matches.map((pattern) => (
    <code key={pattern} className="block">
      {pattern.replace(/^\*:\/\/[^/]*/, '')}
    </code>
  ));
}
