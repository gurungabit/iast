// ============================================================================
// Auth Guard Component
// ============================================================================

import { type ReactNode, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { AuthContext } from '../context/AuthContext';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps): ReactNode {
  const { isAuthenticated, isLoading, userInfo, login } = useAuth();

  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      void login();
    }
  }, [isAuthenticated, isLoading, login]);

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

  // Require auth
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-zinc-950">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-gray-300 dark:border-zinc-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-zinc-500">Redirecting to sign in...</p>
        </div>
      </div>
    );
  }

  // Wrap children with AuthContext provider
  return (
    <AuthContext.Provider
      value={{
        user: userInfo ? { id: userInfo.id, email: userInfo.email } : null,
        isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
