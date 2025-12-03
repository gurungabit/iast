// ============================================================================
// Register Form Component
// ============================================================================

import { useState } from 'react';
import type { RegisterRequest } from '@terminal/shared';
import { ThemeToggle } from './ThemeToggle';

interface RegisterFormProps {
  onSubmit: (request: RegisterRequest) => Promise<boolean>;
  onSwitchToLogin: () => void;
  isLoading: boolean;
  error: string | null;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export function RegisterForm({
  onSubmit,
  onSwitchToLogin,
  isLoading,
  error,
  theme,
  onToggleTheme,
}: RegisterFormProps): React.ReactNode {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setLocalError(null);

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters');
      return;
    }

    await onSubmit({ email, password });
  };

  const displayError = localError ?? error;

  return (
    <div className="min-h-screen flex flex-col transition-colors" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Theme toggle in corner */}
      <div className="absolute top-4 right-4">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="rounded-xl shadow-lg p-8" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-default)', borderWidth: '1px' }}>
            <h1 className="text-2xl font-bold text-center mb-2" style={{ color: 'var(--text-primary)' }}>
              Terminal
            </h1>
            <p className="text-center mb-8" style={{ color: 'var(--text-secondary)' }}>
              Create your account
            </p>

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-default)', borderWidth: '1px', color: 'var(--text-primary)' }}
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-default)', borderWidth: '1px', color: 'var(--text-primary)' }}
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-default)', borderWidth: '1px', color: 'var(--text-primary)' }}
                  placeholder="••••••••"
                />
              </div>

              {displayError && (
                <div className="p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-400 text-sm">
                  {displayError}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Already have an account?{' '}
              </span>
              <button
                onClick={onSwitchToLogin}
                className="text-blue-500 hover:text-blue-400 hover:underline text-sm font-medium"
              >
                Sign in
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
