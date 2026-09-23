import { z } from 'zod';
import { TabOpSchema } from './schema';
import { isHttpUrl, MAX_URL_LENGTH } from './url';

/** Requests from the content script to the background. The background validates each one with this schema. */
export const BackgroundMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('tab'), op: TabOpSchema }),
  z.object({
    type: z.literal('openUrl'),
    /** Absolute: the content script resolves relative URLs against the page first. */
    url: z.string().max(MAX_URL_LENGTH).refine(isHttpUrl, 'Only http(s) URLs can be opened.'),
    background: z.boolean(),
  }),
]);
export type BackgroundMessage = z.infer<typeof BackgroundMessageSchema>;

export type BackgroundResponse = { ok: true } | { ok: false; error: string };
