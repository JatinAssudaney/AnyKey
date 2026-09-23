import { defineBackground } from 'wxt/utils/define-background';
import { listenForMessages } from '../background/router';

export default defineBackground(() => {
  // Listeners register synchronously so a restarted service worker catches the message that woke it.
  listenForMessages();
});
