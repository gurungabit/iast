// ============================================================================
// Auth Guard Component - MSAL Authentication
// ============================================================================

import { type ReactNode, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { AuthContext } from '../context/AuthContext';
import { ThemeToggle } from './ThemeToggle';
import { enableDevMode, isDevModeAvailable } from '../utils/tokenAccessor';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps): ReactNode {
  const { isAuthenticated, isLoading, userInfo, login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [devAuthenticated, setDevAuthenticated] = useState(false);

  // Dev mode login - bypasses MSAL
  const handleDevLogin = () => {
    enableDevMode();
    setDevAuthenticated(true);
  };

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-zinc-950">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-gray-300 dark:border-zinc-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-zinc-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Check if authenticated (either via MSAL or dev mode)
  const effectivelyAuthenticated = isAuthenticated || devAuthenticated;

  // Show login screen if not authenticated
  if (!effectivelyAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col transition-colors bg-white dark:bg-zinc-950">
        {/* Theme toggle in corner */}
        <div className="absolute top-4 right-4">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="rounded-xl shadow-lg p-8 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
              <h1 className="text-2xl font-bold text-center mb-2 text-gray-900 dark:text-zinc-100">
                Terminal
              </h1>
              <p className="text-center mb-8 text-gray-600 dark:text-zinc-400">
                Sign in with your Microsoft account
              </p>

              <button
                onClick={() => login()}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 dark:border-zinc-700 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 21 21"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                  <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                  <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                  <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
                </svg>
                Sign in with Microsoft
              </button>

              {/* Dev Login - only shown in development mode */}
              {isDevModeAvailable() && (
                <button
                  onClick={handleDevLogin}
                  className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-amber-400 dark:border-amber-600 rounded-lg text-sm font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                >
                  <span>🔧</span>
                  Dev Login (No Azure)
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Dev mode user info
  const devUserInfo = devAuthenticated ? {
    id: 'dev-user-001',
    email: 'dev@local.test',
    name: 'Dev User',
  } : null;

  const effectiveUserInfo = userInfo || devUserInfo;

  // Wrap children with AuthContext provider
  return (
    <AuthContext.Provider
      value={{
        user: effectiveUserInfo ? {
          id: effectiveUserInfo.id,
          email: effectiveUserInfo.email,
          displayName: effectiveUserInfo.name
        } : null,
        isAuthenticated: effectivelyAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
