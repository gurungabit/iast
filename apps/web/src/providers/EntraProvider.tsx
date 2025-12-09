// ============================================================================
// Entra (MSAL) Provider wrapper
// ============================================================================

import { useEffect, useState } from 'react';
import { MsalProvider } from '@azure/msal-react';
import { msalInstance } from '../config/msalConfig';

interface Props {
  children: React.ReactNode;
}

export function EntraProvider({ children }: Props): React.ReactNode {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    msalInstance.initialize().then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-zinc-950">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-gray-300 dark:border-zinc-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-zinc-500">Loading auth...</p>
        </div>
      </div>
    );
  }

  return <MsalProvider instance={msalInstance}>{children}</MsalProvider>;
}

