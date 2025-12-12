// ============================================================================
// CredentialsInput - Reusable username/password input for AST forms
// ============================================================================

import { Input } from '../../components/ui';

interface CredentialsInputProps {
  username: string;
  password: string;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  disabled?: boolean;
  showPassword?: boolean;
}

export function CredentialsInput({
  username,
  password,
  onUsernameChange,
  onPasswordChange,
  disabled = false,
}: CredentialsInputProps): React.ReactNode {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Input
        label="Username"
        placeholder="Mainframe username"
        value={username}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUsernameChange(e.target.value)}
        disabled={disabled}
        autoComplete="username"
      />

      <Input
        label="Password"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onPasswordChange(e.target.value)}
        disabled={disabled}
        autoComplete="current-password"
      />
    </div>
  );
}
