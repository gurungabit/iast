import { useState, useEffect, useRef } from 'react';
import { setStoredSessionId } from '../utils/storage';
import { createSession, getSessions, updateSession, deleteSession } from '../services/session';
import { CreateSessionModal } from './CreateSessionModal';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { ErrorModal } from './ErrorModal';
import { Edit, Trash2 } from 'lucide-react';
import type { UserSession } from '@terminal/shared';

export default function SessionSelector({
  value,
  onChange,
}: {
  value?: string;
  onChange: (id: string) => void;
}) {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    session: UserSession | null;
    isDeleting: boolean;
    isLastSession: boolean;
  }>({ isOpen: false, session: null, isDeleting: false, isLastSession: false });
  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({ isOpen: false, title: '', message: '' });
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setEditingId(null);
        setEditName('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadSessions = async () => {
    try {
      const data = await getSessions();
      setSessions(data);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setIsModalOpen(true);
    setIsOpen(false);
  };

  const handleCreateSession = async (name: string) => {
    setIsCreating(true);
    try {
      const session = await createSession(name);
      setSessions((prev) => [session, ...prev]);
      setStoredSessionId(session.id);
      onChange(session.id);
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error; // Let the modal handle the error display
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelect = (session: UserSession) => {
    if (editingId === session.id) return;
    setStoredSessionId(session.id);
    onChange(session.id);
    setIsOpen(false);
    setEditingId(null);
    setEditName('');
  };

  const handleStartEdit = (session: UserSession, event: React.MouseEvent) => {
    event.stopPropagation();
    setEditingId(session.id);
    setEditName(session.name);
  };

  const handleSaveEdit = async (sessionId: string) => {
    if (!editName.trim()) return;

    try {
      const updated = await updateSession(sessionId, editName.trim());
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? updated : s)));
      setEditingId(null);
      setEditName('');
    } catch (error) {
      console.error('Failed to update session:', error);
      setErrorModal({
        isOpen: true,
        title: 'Update Failed',
        message: 'Failed to update session. Please try again.',
      });
    }
  };

  const handleDeleteClick = (session: UserSession, event: React.MouseEvent) => {
    event.stopPropagation();
    const isLastSession = sessions.length === 1;
    setDeleteModal({ isOpen: true, session, isDeleting: false, isLastSession });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.session) return;

    setDeleteModal((prev) => ({ ...prev, isDeleting: true }));

    try {
      await deleteSession(deleteModal.session!.id);
      const remaining = sessions.filter((s) => s.id !== deleteModal.session!.id);
      setSessions(remaining);

      if (remaining.length > 0 && value === deleteModal.session!.id) {
        // If current session was deleted, select the first available
        handleSelect(remaining[0]);
      } else if (remaining.length === 0) {
        // No sessions left, notify parent
        onChange('');
      }

      setDeleteModal({ isOpen: false, session: null, isDeleting: false, isLastSession: false });
    } catch (error) {
      console.error('Failed to delete session:', error);
      setDeleteModal((prev) => ({ ...prev, isDeleting: false }));
      setErrorModal({
        isOpen: true,
        title: 'Delete Failed',
        message: 'Failed to delete session. Please try again.',
      });
    }
  };

  const currentSession = sessions.find((s) => s.id === value);

  if (loading) {
    return (
      <div className="px-3 py-2 rounded border bg-white dark:bg-zinc-900 text-sm">
        Loading sessions...
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <>
        <button
          onClick={handleCreateNew}
          className="cursor-pointer px-3 py-2 rounded border bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors text-sm"
        >
          Connect
        </button>
        <CreateSessionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onCreate={handleCreateSession}
          isLoading={isCreating}
        />
      </>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="cursor-pointer flex items-center gap-2 px-3 py-2 rounded border bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
      >
        <span className="text-sm">{currentSession?.name || value || 'Select session'}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1 w-80 bg-white dark:bg-zinc-900 border rounded shadow-lg z-10 max-h-60 overflow-auto">
          {sessions.map((session) => (
            <div key={session.id} className="relative group">
              {editingId === session.id ? (
                <div className="flex items-center gap-2 px-3 py-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit(session.id);
                      if (e.key === 'Escape') {
                        setEditingId(null);
                        setEditName('');
                      }
                    }}
                    className="flex-1 px-2 py-1 text-sm border rounded bg-white dark:bg-zinc-800"
                    autoFocus
                  />
                  <button
                    onClick={() => handleSaveEdit(session.id)}
                    className="cursor-pointer text-green-600 hover:text-green-700 text-sm"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(null);
                      setEditName('');
                    }}
                    className="cursor-pointer text-gray-500 hover:text-gray-700 text-sm"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleSelect(session)}
                  className={`w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors text-sm flex items-center justify-between ${
                    value === session.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <span className="truncate">{session.name}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={(e) => handleStartEdit(session, e)}
                      className="cursor-pointer text-gray-500 hover:text-gray-700 text-sm"
                      title="Rename"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={(e) => handleDeleteClick(session, e)}
                      className="cursor-pointer text-red-500 hover:text-red-700 text-sm"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </button>
              )}
            </div>
          ))}
          <div className="border-t border-gray-200 dark:border-zinc-700">
            <button
              onClick={handleCreateNew}
              className="cursor-pointer w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors text-sm text-blue-600 dark:text-blue-400"
            >
              + Connect
            </button>
          </div>
        </div>
      )}

      <CreateSessionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateSession}
        isLoading={isCreating}
      />

      <DeleteConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() =>
          setDeleteModal({ isOpen: false, session: null, isDeleting: false, isLastSession: false })
        }
        onConfirm={handleConfirmDelete}
        sessionName={deleteModal.session?.name || ''}
        isLoading={deleteModal.isDeleting}
        isLastSession={deleteModal.isLastSession}
      />

      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ isOpen: false, title: '', message: '' })}
        title={errorModal.title}
        message={errorModal.message}
      />
    </div>
  );
}
