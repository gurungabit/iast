import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { MsalProvider } from '@azure/msal-react';
import './index.css';
import { routeTree } from './routeTree.gen';
import { initializeMsal, msalInstance } from './auth/entra';

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById('root');
if (rootElement && !rootElement.innerHTML) {
  initializeMsal()
    .then(() => {
      const root = createRoot(rootElement);
      root.render(
        <StrictMode>
          <MsalProvider instance={msalInstance}>
            <RouterProvider router={router} />
          </MsalProvider>
        </StrictMode>,
      );
    })
    .catch((error) => {
      console.error('Failed to initialize MSAL', error);
    });
}
