import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ContentScriptContext } from 'wxt/utils/content-script-context';
import '@/assets/tailwind.css';
import { startAnyKey } from '@/dom/app';
import { App } from './App';

// The browser runs no content script in extension pages, and this page teaches AnyKey's keys, which people press
// right away. So AnyKey starts here itself, all but the picker: site shortcuts are for web pages.
startAnyKey(new ContentScriptContext('welcome', { noScriptStartedPostMessage: true }), { picker: false });

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
