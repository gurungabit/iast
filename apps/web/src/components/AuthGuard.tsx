// ============================================================================
// Auth Guard Component
// ============================================================================

import { useState, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { AuthContext } from '../context/AuthContext';

type AuthView = 'login' | 'register';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps): ReactNode {
  const { state: authState, login, register } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [authView, setAuthView] = useState<AuthView>('login');

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
    if (authView === 'login') {
      return (
        <LoginForm
          onSubmit={login}
          onSwitchToRegister={() => setAuthView('register')}
          isLoading={authState.isLoading}
          error={authState.error}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      );
    }

    return (
      <RegisterForm
        onSubmit={register}
        onSwitchToLogin={() => setAuthView('login')}
        isLoading={authState.isLoading}
        error={authState.error}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
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
