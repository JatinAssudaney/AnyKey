import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/assets/tailwind.css';
import { locale } from '@/i18n';
import { App } from './App';

// The page is in the language of the text AnyKey shows, which the browser picks.
document.documentElement.lang = locale();

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
