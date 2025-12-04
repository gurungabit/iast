// ============================================================================
// ItemResultList Component - Display AST item results
// ============================================================================

import type { ASTItemResult } from '../../ast/types';

export interface ItemResultListProps {
  /** List of item results */
  items: ASTItemResult[];
  /** Maximum height for scrollable area */
  maxHeight?: string;
  /** Additional class names */
  className?: string;
}

const statusStyles = {
  pending: 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400',
  running: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  success: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  failed: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  skipped: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
};

const statusIcons = {
  pending: '○',
  running: '◐',
  success: '✓',
  failed: '✕',
  skipped: '⊘',
};

export function ItemResultList({
  items,
  maxHeight = '200px',
  className = '',
}: ItemResultListProps): React.ReactNode {
  if (items.length === 0) {
    return null;
  }

  return (
    <div 
      className={`space-y-1 overflow-y-auto ${className}`}
      style={{ maxHeight }}
    >
      {items.map((item, index) => (
        <div
          key={`${item.itemId}-${index}`}
          className={`
            flex items-center justify-between px-2 py-1.5 rounded text-xs
            ${statusStyles[item.status]}
          `}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono">{statusIcons[item.status]}</span>
            <span className="font-mono truncate">{item.itemId}</span>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            {item.durationMs !== undefined && (
              <span className="text-[10px] opacity-75">
                {item.durationMs}ms
              </span>
            )}
            {item.error && (
              <span className="text-[10px] text-red-600 dark:text-red-400 truncate max-w-[100px]">
                {item.error}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
