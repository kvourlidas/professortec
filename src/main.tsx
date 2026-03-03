import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import { AuthProvider } from './auth';
import './index.css';

/**
 * If your app is hosted under a subpath (e.g. https://domain.com/admin),
 * set this to "/admin". Otherwise leave it as "".
 *
 * Tip: Prefer env var so prod/dev differ cleanly.
 */
const BASENAME = import.meta.env.VITE_ROUTER_BASENAME ?? '';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter basename={BASENAME}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
