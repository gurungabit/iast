// ============================================================================
// Delete Confirmation Modal - Modal for confirming session deletion
// ============================================================================

import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

export interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  sessionName: string;
  isLoading?: boolean;
  isLastSession?: boolean;
}

export function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  sessionName,
  isLoading = false,
  isLastSession = false,
}: DeleteConfirmationModalProps) {
  const handleConfirm = async () => {
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      // Error handling is done in the parent component
      console.error('Failed to delete session:', error);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Session" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-700 dark:text-zinc-300">
          Are you sure you want to delete the session <strong>"{sessionName}"</strong>?
        </p>
        {isLastSession && (
          <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded border border-amber-200 dark:border-amber-800">
            ⚠️ This is your last session. A new session will be created automatically after
            deletion.
          </p>
        )}
        <p className="text-xs text-gray-500 dark:text-zinc-500">This action cannot be undone.</p>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="button" variant="danger" onClick={handleConfirm} isLoading={isLoading}>
          Delete Session
        </Button>
      </div>
    </Modal>
  );
}
