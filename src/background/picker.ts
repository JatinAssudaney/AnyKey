import { browser } from 'wxt/browser';
import { z } from 'zod/mini';
import type { PageRequest } from '../core/messages';

// Picker sessions (rules in docs/design.md, "Picker"). A content script may save a shortcut only while the user has
// a picker open in its tab: the popup starts a session, and saving or closing the picker ends it. Sessions live in
// storage.session, which content scripts can't read or write, and which outlives a service worker restart.

/** A picker left open this long can no longer save. */
export const SESSION_MS = 30 * 60_000;

const SessionSchema = z.object({ startedAt: z.number(), host: z.string() });

function sessionKey(tabId: number): string {
  return `picker:${tabId}`;
}

/** Opens a session for `host` and starts the picker in the tab. */
export async function startPicker(tabId: number, host: string): Promise<void> {
  await browser.storage.session.set({ [sessionKey(tabId)]: { startedAt: Date.now(), host } });
  try {
    await browser.tabs.sendMessage<PageRequest, unknown>(tabId, { type: 'startPicker' }, { frameId: 0 });
  } catch {
    await endSession(tabId);
    throw new Error("AnyKey isn't running in this tab. Reload the tab, then try again.");
  }
}

/** Tabs with a save running. A page could send many saves at once, and each would find the session still open. */
const saving = new Set<number>();

/**
 * Runs `save` while the tab has a picker open for `host`, then ends the session, so a session saves once. Only one
 * save runs per tab at a time.
 */
export async function saveInSession(tabId: number, host: string, save: () => Promise<void>): Promise<void> {
  if (saving.has(tabId)) throw new Error('AnyKey is still saving the last shortcut.');
  saving.add(tabId);
  try {
    if (!(await hasSession(tabId, host))) {
      throw new Error("To add a shortcut, start again from AnyKey's button in the toolbar.");
    }
    await save();
    await endSession(tabId);
  } finally {
    saving.delete(tabId);
  }
}

/** Whether the tab has a picker open for `host` that may still save. */
async function hasSession(tabId: number, host: string, now = Date.now()): Promise<boolean> {
  const key = sessionKey(tabId);
  const { [key]: raw } = await browser.storage.session.get(key);
  const session = SessionSchema.safeParse(raw);
  return session.success && session.data.host === host && now - session.data.startedAt < SESSION_MS;
}

export async function endSession(tabId: number): Promise<void> {
  await browser.storage.session.remove(sessionKey(tabId));
}
