// ============================================================================
// Create Session Modal - Modal for creating new user sessions
// ============================================================================

import { useState, type FormEvent } from 'react';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Button } from './ui/Button';

export interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
  isLoading?: boolean;
}

export function CreateSessionModal({
  isOpen,
  onClose,
  onCreate,
  isLoading = false,
}: CreateSessionModalProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Session name is required');
      return;
    }

    if (trimmedName.length > 50) {
      setError('Session name must be 50 characters or less');
      return;
    }

    try {
      setError('');
      await onCreate(trimmedName);
      setName('');
      onClose();
    } catch (err) {
      setError('Failed to create session. Please try again.');
      console.error('Failed to create session:', err);
    }
  };

  const handleClose = () => {
    setName('');
    setError('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create New Session"
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Session Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter a name for your session"
          error={error}
          hint="Choose a descriptive name for your terminal session"
          disabled={isLoading}
          autoFocus
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading}
            disabled={!name.trim() || isLoading}
          >
            Create Session
          </Button>
        </div>
      </form>
    </Modal>
  );
}
