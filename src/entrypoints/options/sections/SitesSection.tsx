import { Fragment, useId, useLayoutEffect, useRef, useState } from 'react';
import { Chevron } from '@/components/Chevron';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { focusAfterRender } from '@/components/focus';
import { isMac } from '@/components/platform';
import {
  card,
  checkbox,
  fieldLabel,
  hintText,
  linkButton,
  primaryButton,
  secondaryButton,
  sectionHeading,
  textInput,
} from '@/components/styles';
import { findConflicts, type Conflict } from '@/core/conflicts';
import type { SiteState, SyncData } from '@/core/docs';
import type { Mutation } from '@/core/messages';
import { presetHosts, type Preset } from '@/core/presets';
import { shortcutsOnSite, type SiteShortcuts } from '@/core/resolve';
import type { Shortcut } from '@/core/schema';
import { count, siteMatches, sortHosts } from '../sites';
import { PresetPanel } from './PresetPanel';
import { ShortcutDialog, type Editing } from './ShortcutDialog';
import { ShortcutTable } from './ShortcutTable';

interface SitesSectionProps {
  data: SyncData;
  presets: readonly Preset[];
  mutate: (mutation: Mutation) => Promise<string | null>;
  /** The site whose settings show. One shows at a time, so the list stays short however many sites it holds. */
  openSite: string | null;
  onOpenSite: (host: string | null) => void;
}

interface Resetting {
  preset: Preset;
  site: string;
  deleteShortcuts: boolean;
}

/** A site in the list. */
interface Row {
  host: string;
  site: SiteState;
  /** The whole site, from `shortcutsOnSite`. */
  whole: SiteShortcuts;
  /** Conflicts among the site's shortcuts and with its own keys. */
  conflicts: ReadonlyMap<string, readonly Conflict[]>;
}

const EMPTY_SITE: SiteState = { disabled: false, shortcuts: [], globals: new Map() };

/** An inset ring for the full-width buttons that open a site, which a ring outside them would run past. */
const rowFocusRing =
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-orange-700 dark:focus-visible:outline-orange-400';

export function SitesSection({ data, presets, mutate, openSite, onOpenSite }: SitesSectionProps) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<{ shortcut: Shortcut; site: string } | null>(null);
  const [resetting, setResetting] = useState<Resetting | null>(null);
  // Sites changed on this page stay listed once they hold nothing, so no control vanishes while it is being used.
  const [kept, setKept] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState('');
  const [shownOpen, setShownOpen] = useState(openSite);
  // Where the row that was clicked sat on screen, so it stays there when the site open above it closes.
  const anchor = useRef<{ host: string; top: number } | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const searchId = useId();
  const { state } = data;
  const rows = sortHosts(new Set([...state.sites.keys(), ...presets.flatMap(presetHosts), ...kept])).map(
    (host): Row => {
      const whole = shortcutsOnSite(state, presets, host);
      const site = state.sites.get(host) ?? EMPTY_SITE;
      return { host, site, whole, conflicts: findConflicts(whole.shortcuts, isMac, whole.native) };
    },
  );
  const shown = rows.filter(({ host, whole }) =>
    siteMatches(
      host,
      whole.presets.map(({ name }) => name),
      query,
    ),
  );
  // A site opened by a save elsewhere (a shortcut put there) shows, even if the search had hidden it.
  if (openSite !== shownOpen) {
    setShownOpen(openSite);
    if (openSite !== null && !shown.some(({ host }) => host === openSite)) setQuery('');
  }
  const typed = query.trim();
  const found =
    typed === '' ? '' : shown.length === 0 ? `No site matches "${typed}".` : `${shown.length} of ${count(rows.length, 'site')}`;

  const send = (mutation: Mutation): void => {
    void mutate(mutation);
  };
  const keep = (host: string): void => {
    setKept((current) => (current.has(host) ? current : new Set(current).add(host)));
  };
  const toggle = (host: string, button: HTMLElement): void => {
    anchor.current = { host, top: button.getBoundingClientRect().top };
    onOpenSite(openSite === host ? null : host);
  };

  // Opening a site closes the open one, which may sit above it and be long: the clicked row keeps its place.
  useLayoutEffect(() => {
    const held = anchor.current;
    anchor.current = null;
    const button = held === null ? null : document.getElementById(toggleId(held.host));
    if (held !== null && button !== null) {
      window.scrollBy({ top: button.getBoundingClientRect().top - held.top, behavior: 'instant' });
    }
  });

  return (
    <section aria-labelledby="sites-heading" className={card}>
      <h2 id="sites-heading" className={sectionHeading}>
        Sites
      </h2>
      <p className={hintText}>
        Shortcuts for one site, the presets AnyKey has for some sites, and sites where AnyKey is off. To bind a key to
        something on a page, open the page and use AnyKey&apos;s button in the toolbar.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-48 grow">
          <label htmlFor={searchId} className={fieldLabel}>
            Find a site
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            onKeyDown={(event) => {
              // Enter opens the first site found.
              const first = shown[0];
              if (event.key !== 'Enter' || typed === '' || first === undefined) return;
              event.preventDefault();
              onOpenSite(first.host);
              focusAfterRender(() => document.getElementById(toggleId(first.host)));
            }}
            className={`${textInput} mt-1`}
          />
        </div>
        <button
          ref={addButton}
          type="button"
          onClick={() => {
            setEditing({ kind: 'new', site: '' });
          }}
          className={primaryButton}
        >
          Add a site shortcut
        </button>
      </div>
      {/* Always in the page, so screen readers announce what the search finds. */}
      <p role="status" className={found === '' ? 'sr-only' : hintText}>
        {found}
      </p>

      {rows.length === 0 && <p className={`${hintText} mt-4`}>No sites yet.</p>}
      {shown.length > 0 && (
        <ul className="mt-3 divide-y divide-stone-200 overflow-clip rounded-md border border-stone-200 [overflow-anchor:none] dark:divide-stone-800 dark:border-stone-800">
          {shown.map((row) => {
            const { host, site, whole, conflicts } = row;
            const open = host === openSite;
            return (
              <li key={host}>
                <div
                  className={`flex items-center gap-3 pr-4 hover:bg-stone-50 dark:hover:bg-stone-800/50 ${open ? 'bg-stone-50 dark:bg-stone-800/50' : ''}`}
                >
                  <h3 className="min-w-0 grow">
                    <button
                      id={toggleId(host)}
                      type="button"
                      aria-expanded={open}
                      aria-controls={open ? panelId(host) : undefined}
                      aria-labelledby={siteHeadingId(host)}
                      aria-describedby={summaryId(host)}
                      onClick={(event) => {
                        toggle(host, event.currentTarget);
                      }}
                      className={`flex w-full items-center gap-3 rounded-md py-3 pl-4 text-left ${rowFocusRing}`}
                    >
                      <Chevron className={open ? 'rotate-90' : ''} />
                      <span className="min-w-0">
                        <span id={siteHeadingId(host)} className="block text-sm font-semibold break-all">
                          {host}
                        </span>
                        <SiteSummary id={summaryId(host)} row={row} />
                      </span>
                    </button>
                  </h3>
                  <label className="flex shrink-0 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      role="switch"
                      checked={!site.disabled}
                      onChange={(event) => {
                        keep(host);
                        send({ op: 'setSiteDisabled', site: host, disabled: !event.target.checked });
                      }}
                      className={checkbox}
                    />
                    Use AnyKey<span className="sr-only"> on {host}</span>
                  </label>
                </div>

                {open && (
                  <div
                    id={panelId(host)}
                    role="region"
                    aria-labelledby={siteHeadingId(host)}
                    className="border-t border-stone-200 px-4 pb-6 sm:pl-11 dark:border-stone-800"
                  >
                    {site.disabled && (
                      <p className={`${hintText} mt-4`}>AnyKey is off on this site, so every key goes to the site.</p>
                    )}
                    {whole.presets.length > 0 && <h4 className="mt-4 text-sm font-semibold">Your shortcuts</h4>}
                    {site.shortcuts.length === 0 ? (
                      <p className={`${hintText} mt-4`}>No shortcuts for this site.</p>
                    ) : (
                      <ShortcutTable
                        caption={`Shortcuts for ${host}`}
                        hideCaption
                        shortcuts={site.shortcuts}
                        conflicts={conflicts}
                        describe
                        onToggle={(shortcut, enabled) => {
                          send({ op: 'saveShortcut', shortcut: { ...shortcut, enabled }, site: host });
                        }}
                        onEdit={(shortcut) => {
                          setEditing({ kind: 'user', shortcut, site: host });
                        }}
                        extra={(shortcut) => (
                          <button
                            type="button"
                            onClick={() => {
                              setDeleting({ shortcut, site: host });
                            }}
                            className={linkButton}
                          >
                            Delete<span className="sr-only"> {shortcut.label}</span>
                          </button>
                        )}
                      />
                    )}
                    <button
                      id={addButtonId(host)}
                      type="button"
                      onClick={() => {
                        setEditing({ kind: 'new', site: host });
                      }}
                      className={`${secondaryButton} mt-3`}
                    >
                      Add shortcut for {host}
                    </button>
                    {whole.presets.map((preset) => (
                      <PresetPanel
                        key={preset.id}
                        preset={preset}
                        host={host}
                        data={data}
                        site={whole}
                        conflicts={conflicts}
                        send={send}
                        onEdit={setEditing}
                        onReset={() => {
                          setResetting({ preset, site: host, deleteShortcuts: false });
                        }}
                      />
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editing !== null && (
        <ShortcutDialog
          editing={editing}
          data={data}
          presets={presets}
          onSave={(mutation) => {
            if (mutation.op === 'saveShortcut' && mutation.site !== undefined) {
              keep(mutation.site);
              onOpenSite(mutation.site);
            }
            if (editing.kind === 'user' && editing.site !== undefined) keep(editing.site);
            send(mutation);
          }}
          onClose={() => {
            setEditing(null);
          }}
        />
      )}
      {deleting !== null && (
        <ConfirmDialog
          title={`Delete "${deleting.shortcut.label}"?`}
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            keep(deleting.site);
            send({ op: 'deleteShortcut', id: deleting.shortcut.id });
            // Its row, and the Delete button focus would return to, go away.
            const { site } = deleting;
            focusAfterRender(() => document.getElementById(addButtonId(site)) ?? addButton.current);
          }}
          onClose={() => {
            setDeleting(null);
          }}
        >
          <p>This removes the shortcut from every computer you sync with.</p>
        </ConfirmDialog>
      )}
      {resetting !== null && (
        <ResetDialog
          resetting={resetting}
          shortcuts={state.sites.get(resetting.site)?.shortcuts.length ?? 0}
          onChange={setResetting}
          onConfirm={() => {
            const { preset, site, deleteShortcuts } = resetting;
            keep(site);
            send({ op: 'resetToPreset', preset: preset.id, site, deleteShortcuts });
            // The Reset button, where focus would return, goes away once nothing is left to reset.
            focusAfterRender(() => document.getElementById(addButtonId(site)));
          }}
          onClose={() => {
            setResetting(null);
          }}
        />
      )}
    </section>
  );
}

/** What a site's row sums up: its presets, how many shortcuts it has, and how many of them have a warning. */
function SiteSummary({ id, row }: { id: string; row: Row }) {
  const { site, whole, conflicts } = row;
  const listed = [...site.shortcuts, ...whole.shortcuts.filter(({ source }) => source === 'preset')];
  const warnings = listed.filter((shortcut) => (conflicts.get(shortcut.id)?.length ?? 0) > 0).length;
  const parts = [
    ...whole.presets.map(({ name }) => `${name} preset`),
    ...(site.shortcuts.length > 0
      ? [count(site.shortcuts.length, 'shortcut')]
      : whole.presets.length === 0
        ? ['No shortcuts']
        : []),
  ];
  return (
    <span id={id} className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-stone-600 dark:text-stone-400">
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <span aria-hidden="true">·</span>}
          <span>{part}</span>
        </Fragment>
      ))}
      {warnings > 0 && (
        <>
          {parts.length > 0 && <span aria-hidden="true">·</span>}
          <span className="font-medium text-amber-800 dark:text-amber-300">
            <span aria-hidden="true">⚠ </span>
            {count(warnings, 'warning')}
          </span>
        </>
      )}
    </span>
  );
}

interface ResetDialogProps {
  resetting: Resetting;
  /** How many shortcuts the site keeps. */
  shortcuts: number;
  onChange: (resetting: Resetting) => void;
  onConfirm: () => void;
  onClose: () => void;
}

function ResetDialog({ resetting, shortcuts, onChange, onConfirm, onClose }: ResetDialogProps) {
  const { preset, site } = resetting;
  return (
    <ConfirmDialog
      title={`Reset ${site} to the ${preset.name} preset?`}
      confirmLabel="Reset"
      danger
      onConfirm={onConfirm}
      onClose={onClose}
    >
      <p>
        The {preset.name} preset&apos;s shortcuts go back to their own keys and are all on again, and built-in
        shortcuts give way to {preset.name}&apos;s keys again. This applies on every computer you sync with.
      </p>
      {shortcuts > 0 && (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={resetting.deleteShortcuts}
            onChange={(event) => {
              onChange({ ...resetting, deleteShortcuts: event.target.checked });
            }}
            className={checkbox}
          />
          Also delete your {shortcuts === 1 ? 'shortcut' : `${shortcuts} shortcuts`} for {site}
        </label>
      )}
    </ConfirmDialog>
  );
}

function siteHeadingId(host: string): string {
  return `site-${host}`;
}

function summaryId(host: string): string {
  return `site-summary-${host}`;
}

function toggleId(host: string): string {
  return `site-toggle-${host}`;
}

function panelId(host: string): string {
  return `site-panel-${host}`;
}

function addButtonId(host: string): string {
  return `add-shortcut-${host}`;
}
