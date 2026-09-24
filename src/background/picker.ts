import { browser } from 'wxt/browser';
import { z } from 'zod/mini';
import type { PageRequest } from '../core/messages';

// Picker sessions (rules in docs/design.md, "Picker"). A content script may save shortcuts only while the user has a
// picker open in its tab: the popup starts a session, and closing the picker ends it. Sessions live in
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

/** Whether the tab has a picker open for `host` that may still save. */
export async function hasSession(tabId: number, host: string, now = Date.now()): Promise<boolean> {
  const key = sessionKey(tabId);
  const { [key]: raw } = await browser.storage.session.get(key);
  const session = SessionSchema.safeParse(raw);
  return session.success && session.data.host === host && now - session.data.startedAt < SESSION_MS;
}

export async function endSession(tabId: number): Promise<void> {
  await browser.storage.session.remove(sessionKey(tabId));
}
