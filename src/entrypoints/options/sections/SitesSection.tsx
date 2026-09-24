import { useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { focusAfterRender } from '@/components/focus';
import { isMac } from '@/components/platform';
import { card, checkbox, hintText, linkButton, primaryButton, secondaryButton, sectionHeading } from '@/components/styles';
import { findConflicts } from '@/core/conflicts';
import type { SiteState, SyncData } from '@/core/docs';
import type { Mutation } from '@/core/messages';
import { effectiveDefaults } from '@/core/resolve';
import type { Shortcut } from '@/core/schema';
import { ShortcutDialog, type Editing } from './ShortcutDialog';
import { ShortcutTable } from './ShortcutTable';

interface SitesSectionProps {
  data: SyncData;
  mutate: (mutation: Mutation) => Promise<string | null>;
}

const EMPTY_SITE: SiteState = { disabled: false, shortcuts: [], globals: new Map() };

export function SitesSection({ data, mutate }: SitesSectionProps) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<{ shortcut: Shortcut; site: string } | null>(null);
  // Sites changed on this page stay listed once they hold nothing, so no control vanishes while it is being used.
  const [kept, setKept] = useState<ReadonlySet<string>>(new Set());
  const addButton = useRef<HTMLButtonElement>(null);
  const { state } = data;
  const hosts = [...new Set([...state.sites.keys(), ...kept])].sort();
  const send = (mutation: Mutation): void => {
    void mutate(mutation);
  };
  const keep = (host: string): void => {
    setKept((current) => (current.has(host) ? current : new Set(current).add(host)));
  };

  return (
    <section aria-labelledby="sites-heading" className={card}>
      <h2 id="sites-heading" className={sectionHeading}>
        Sites
      </h2>
      <p className={hintText}>
        Shortcuts for one site, and sites where AnyKey is off. To bind a key to something on a page, open the page and
        use AnyKey&apos;s button in the toolbar.
      </p>

      {hosts.length === 0 && <p className={`${hintText} mt-4`}>No sites yet.</p>}
      {hosts.map((host) => {
        const site = state.sites.get(host) ?? EMPTY_SITE;
        const conflicts = findConflicts(
          [...effectiveDefaults(state, site), ...state.global.shortcuts, ...site.shortcuts],
          isMac,
        );
        return (
          <section key={host} aria-labelledby={siteHeadingId(host)} className="mt-6 border-t border-stone-200 pt-6 dark:border-stone-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 id={siteHeadingId(host)} className="text-sm font-semibold break-all">
                {host}
              </h3>
              <label className="flex items-center gap-2 text-sm">
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
            {site.disabled && (
              <p className={hintText}>AnyKey is off on this site, so every key goes to the site.</p>
            )}
            {site.shortcuts.length === 0 ? (
              <p className={hintText}>No shortcuts for this site.</p>
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
          </section>
        );
      })}

      <button
        ref={addButton}
        type="button"
        onClick={() => {
          setEditing({ kind: 'new', site: '' });
        }}
        className={`${primaryButton} mt-6`}
      >
        Add a site shortcut
      </button>

      {editing !== null && (
        <ShortcutDialog
          editing={editing}
          data={data}
          onSave={(mutation) => {
            if (mutation.op === 'saveShortcut' && mutation.site !== undefined) keep(mutation.site);
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
    </section>
  );
}

function siteHeadingId(host: string): string {
  return `site-${host}`;
}

function addButtonId(host: string): string {
  return `add-shortcut-${host}`;
}
