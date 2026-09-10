import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? '')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');
// In the Replit preview, the API artifact is mounted at /api on the same
// origin. Keep requests relative in dev so VITE_API_URL cannot point the
// browser at a different server that does not expose the admin routes.
if (!import.meta.env.DEV && apiBaseUrl) setBaseUrl(apiBaseUrl);

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
