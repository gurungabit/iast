// ============================================================================
// Main App Component
// ============================================================================

import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { Terminal } from './components/Terminal';
import { LoginForm } from './components/LoginForm';
import { RegisterForm } from './components/RegisterForm';
import { ThemeToggle } from './components/ThemeToggle';

type AuthView = 'login' | 'register';

function App(): React.ReactNode {
  const { state: authState, login, register, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [authView, setAuthView] = useState<AuthView>('login');

  // Show loading spinner while checking auth
  if (authState.isLoading) {
    return (
      <div 
        className="flex items-center justify-center min-h-screen"
        style={{ backgroundColor: theme === 'dark' ? 'var(--color-dark-bg)' : 'var(--color-light-bg)' }}
      >
        <div className="text-center">
          <div 
            className="w-10 h-10 border-3 rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: 'var(--color-border-subtle)', borderTopColor: 'var(--color-accent-primary)' }}
          />
          <p style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
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

  // Show terminal for authenticated users
  return (
    <div 
      className="flex flex-col h-screen"
      style={{ 
        backgroundColor: theme === 'dark' ? 'var(--color-dark-bg)' : 'var(--color-light-bg)',
        color: 'var(--color-text-primary)'
      }}
    >
      {/* Header */}
      <header 
        className="flex items-center justify-between px-4 py-2"
        style={{ 
          backgroundColor: theme === 'dark' ? 'var(--color-dark-elevated)' : '#ffffff',
          borderBottom: '1px solid var(--color-border-subtle)'
        }}
      >
        <div className="flex items-center gap-3">
          <span 
            className="text-lg font-semibold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Terminal
          </span>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <span 
            className="text-sm"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {authState.user?.email}
          </span>
          <button
            onClick={() => void logout()}
            className="px-3 py-1.5 text-sm rounded transition-colors"
            style={{ 
              backgroundColor: theme === 'dark' ? 'var(--color-surface-secondary)' : '#e5e7eb',
              color: 'var(--color-text-primary)'
            }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Terminal */}
      <main className="flex-1 overflow-hidden">
        <Terminal autoConnect={true} />
      </main>
    </div>
  );
}

export default App;
