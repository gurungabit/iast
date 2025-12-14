// ============================================================================
// SessionExpiredModal - Modal shown when TN3270 session expires
// ============================================================================

import { AlertTriangle } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

interface SessionExpiredModalProps {
    isOpen: boolean;
    onCreateNew: () => void;
}

export function SessionExpiredModal({
    isOpen,
    onCreateNew,
}: SessionExpiredModalProps): React.ReactNode {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onCreateNew} // Can only create new, no way to dismiss without action
            size="sm"
            closeOnBackdropClick={false}
            closeOnEscape={false}
            footer={
                <Button onClick={onCreateNew} className="w-full">
                    Create New Session
                </Button>
            }
        >
            <div className="flex flex-col items-center text-center gap-4">
                <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>

                <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">
                        Session Expired
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-zinc-400">
                        Your terminal session has expired due to inactivity.
                        Click below to start a new session.
                    </p>
                </div>
            </div>
        </Modal>
    );
}
