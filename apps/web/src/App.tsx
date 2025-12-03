// ============================================================================
// Main App Component
// ============================================================================

import { useState, useCallback } from 'react';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { useAST } from './hooks/useAST';
import { Terminal } from './components/Terminal';
import { LoginForm } from './components/LoginForm';
import { RegisterForm } from './components/RegisterForm';
import { ThemeToggle } from './components/ThemeToggle';
import { ASTProvider } from './providers/ASTProvider';
import { ASTPanel } from './ast';
import type { ASTStatusMeta } from '@terminal/shared';

type AuthView = 'login' | 'register';

interface TerminalApi {
  runAST: (astName: string, params?: Record<string, unknown>) => void;
}

// ============================================================================
// Main Content Component (uses AST context)
// ============================================================================

function MainContent(): React.ReactNode {
  const { state: authState, login, register, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { setRunCallback, handleASTComplete } = useAST();
  const [authView, setAuthView] = useState<AuthView>('login');

  const handleTerminalReady = useCallback(
    (api: TerminalApi) => {
      // Connect terminal's runAST to AST context
      setRunCallback(api.runAST);
    },
    [setRunCallback]
  );

  const handleASTStatus = useCallback(
    (status: ASTStatusMeta) => {
      // Map ASTStatusType to local ASTStatus type
      // 'pending' from backend maps to 'running' in UI (we're waiting for completion)
      const mappedStatus = status.status === 'pending' ? 'running' : status.status;
      
      // Convert ASTStatusMeta to ASTResult and forward to context
      handleASTComplete({
        status: mappedStatus,
        message: status.message,
        error: status.error,
        duration: status.duration,
        data: status.data,
      });
    },
    [handleASTComplete]
  );

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

  // Show terminal for authenticated users
  return (
    <div className="flex flex-col h-screen bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-100">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-gray-900 dark:text-zinc-100">
            TN3270 Terminal
          </span>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <span className="text-sm text-gray-500 dark:text-zinc-500">
            {authState.user?.email}
          </span>
          <button
            onClick={() => void logout()}
            className="px-3 py-1.5 text-sm rounded transition-colors cursor-pointer
              bg-gray-200 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200
              hover:bg-gray-300 dark:hover:bg-zinc-700"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Terminal + AST Panel */}
      <main className="flex-1 overflow-auto flex p-4 gap-4">
        <Terminal autoConnect={true} onReady={handleTerminalReady} onASTStatus={handleASTStatus} />

        {/* Side panel for AST controls */}
        <div className="w-[300px] flex-shrink-0">
          <ASTPanel />
        </div>
      </main>
    </div>
  );
}

// ============================================================================
// App Component (wraps with providers)
// ============================================================================

function App(): React.ReactNode {
  return (
    <ASTProvider>
      <MainContent />
    </ASTProvider>
  );
}

export default App;
