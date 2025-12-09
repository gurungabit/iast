// ============================================================================
// Auth Guard Component
// ============================================================================

import { type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { AuthContext } from '../context/AuthContext';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps): ReactNode {
  const { state: authState, login } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Show loading spinner while checking auth
  if (authState.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-zinc-950">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-gray-300 dark:border-zinc-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-zinc-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Show auth forms if not authenticated
  if (!authState.isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-zinc-950">
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg shadow-lg p-8 w-full max-w-md space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-zinc-100">Sign in</h1>
            <p className="text-sm text-gray-500 dark:text-zinc-500">
              Continue with your Microsoft Entra account to access the terminal.
            </p>
            {authState.error && (
              <p className="text-sm text-red-500 dark:text-red-400">{authState.error}</p>
            )}
          </div>

          <button
            onClick={() => void login()}
            className="w-full px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
          >
            Sign in with Microsoft
          </button>

          <div className="flex items-center justify-center">
            <button
              onClick={toggleTheme}
              className="text-sm text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300"
            >
              Toggle {theme === 'dark' ? 'Light' : 'Dark'} Mode
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Wrap children with AuthContext provider
  return (
    <AuthContext.Provider
      value={{
        user: authState.user,
        isAuthenticated: authState.isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
