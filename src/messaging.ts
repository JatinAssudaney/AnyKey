import { browser } from 'wxt/browser';
import type { BackgroundMessage, BackgroundResponse } from './core/messages';

// The sending side only. The background's validating listener lives in src/background/router.ts, which keeps zod
// out of the content script bundle.

export async function sendToBackground(message: BackgroundMessage): Promise<BackgroundResponse> {
  try {
    const response = await browser.runtime.sendMessage<BackgroundMessage, unknown>(message);
    return isResponse(response) ? response : { ok: false, error: 'AnyKey did not answer.' };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isResponse(value: unknown): value is BackgroundResponse {
  return typeof value === 'object' && value !== null && 'ok' in value && typeof value.ok === 'boolean';
}
