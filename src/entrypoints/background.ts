import { defineBackground } from 'wxt/utils/define-background';
import { listenForMessages } from '../background/router';
import { createWriter } from '../storage/writer';

export default defineBackground(() => {
  // Listeners register synchronously so a restarted service worker catches the message that woke it.
  listenForMessages(createWriter());
});
