// ============================================================================
// ASTSelector Component - Searchable dropdown for selecting ASTs
// ============================================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { useASTRegistry } from '../registry';
import { CATEGORY_INFO } from '../registry/types';
import type { ASTConfig, ASTCategory } from '../registry/types';

interface ASTSelectorProps {
  /** Currently selected AST ID */
  value: string | null;
  /** Called when selection changes */
  onChange: (id: string | null) => void;
  /** Placeholder text when nothing selected */
  placeholder?: string;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Group results by category */
  groupByCategory?: boolean;
}

export function ASTSelector({
  value,
  onChange,
  placeholder = 'Search ASTs...',
  disabled = false,
  groupByCategory = true,
}: ASTSelectorProps): React.ReactNode {
  const { searchResults, searchQuery, setSearchQuery, getAST, groupedASTs } =
    useASTRegistry();

  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedAST = value ? getAST(value) : null;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlighted index when search changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === 'Enter' || e.key === 'ArrowDown') {
          setIsOpen(true);
          e.preventDefault();
        }
        return;
      }

      const results = searchResults;
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((i) => Math.min(i + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[highlightedIndex]) {
            onChange(results[highlightedIndex].id);
            setIsOpen(false);
            setSearchQuery('');
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          setSearchQuery('');
          break;
      }
    },
    [isOpen, searchResults, highlightedIndex, onChange, setSearchQuery]
  );

  const handleSelect = useCallback(
    (ast: ASTConfig) => {
      onChange(ast.id);
      setIsOpen(false);
      setSearchQuery('');
      inputRef.current?.blur();
    },
    [onChange, setSearchQuery]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(null);
      setSearchQuery('');
    },
    [onChange, setSearchQuery]
  );

  const handleInputFocus = useCallback(() => {
    if (!disabled) {
      setIsOpen(true);
    }
  }, [disabled]);

  // Render grouped results
  const renderGroupedResults = () => {
    const categories = Object.keys(groupedASTs) as ASTCategory[];
    let flatIndex = 0;

    return categories.map((category) => {
      const asts = groupedASTs[category].filter((ast) =>
        searchQuery ? searchResults.includes(ast) : true
      );

      if (asts.length === 0) return null;

      return (
        <div key={category}>
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-500 bg-gray-50 dark:bg-zinc-800/50 sticky top-0">
            {CATEGORY_INFO[category].name}
          </div>
          {asts.map((ast) => {
            const index = flatIndex++;
            return (
              <ASTOption
                key={ast.id}
                ast={ast}
                isHighlighted={index === highlightedIndex}
                isSelected={ast.id === value}
                onClick={() => handleSelect(ast)}
                onMouseEnter={() => setHighlightedIndex(index)}
              />
            );
          })}
        </div>
      );
    });
  };

  // Render flat results
  const renderFlatResults = () => {
    return searchResults.map((ast, index) => (
      <ASTOption
        key={ast.id}
        ast={ast}
        isHighlighted={index === highlightedIndex}
        isSelected={ast.id === value}
        onClick={() => handleSelect(ast)}
        onMouseEnter={() => setHighlightedIndex(index)}
      />
    ));
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Input / Display */}
      <div
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors
          ${disabled 
            ? 'bg-gray-100 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 cursor-not-allowed' 
            : 'bg-white dark:bg-zinc-900 border-gray-300 dark:border-zinc-700 cursor-text hover:border-gray-400 dark:hover:border-zinc-600'}
          ${isOpen ? 'border-blue-500 dark:border-blue-500 ring-1 ring-blue-500/20' : ''}
        `}
        onClick={() => !disabled && inputRef.current?.focus()}
      >
        {/* Search icon */}
        <svg
          className="w-4 h-4 text-gray-400 dark:text-zinc-500 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>

        {/* Input or selected display */}
        {isOpen || !selectedAST ? (
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
            placeholder={selectedAST ? selectedAST.name : placeholder}
            disabled={disabled}
            className="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500"
          />
        ) : (
          <div className="flex-1 flex items-center gap-2">
            <span className="text-sm text-gray-900 dark:text-zinc-100">
              {selectedAST.name}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500">
              {CATEGORY_INFO[selectedAST.category].name}
            </span>
          </div>
        )}

        {/* Clear button */}
        {selectedAST && !isOpen && (
          <button
            type="button"
            onClick={handleClear}
            className="p-0.5 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Dropdown arrow */}
        <svg
          className={`w-4 h-4 text-gray-400 dark:text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={listRef}
          className="absolute z-50 w-full mt-1 max-h-[300px] overflow-auto rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg"
        >
          {searchResults.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-zinc-500">
              No ASTs found matching "{searchQuery}"
            </div>
          ) : groupByCategory && !searchQuery ? (
            renderGroupedResults()
          ) : (
            renderFlatResults()
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ASTOption Component - Single option in the dropdown
// ============================================================================

interface ASTOptionProps {
  ast: ASTConfig;
  isHighlighted: boolean;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}

function ASTOption({
  ast,
  isHighlighted,
  isSelected,
  onClick,
  onMouseEnter,
}: ASTOptionProps): React.ReactNode {
  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`
        flex items-start gap-3 px-3 py-2 cursor-pointer transition-colors
        ${isHighlighted ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
        ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : ''}
      `}
    >
      {/* Icon placeholder */}
      <div className="w-8 h-8 rounded-md bg-gray-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-xs font-bold text-gray-500 dark:text-zinc-500">
          {ast.name.charAt(0).toUpperCase()}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-zinc-100">
            {ast.name}
          </span>
          {ast.version && (
            <span className="text-[10px] text-gray-400 dark:text-zinc-600">
              v{ast.version}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-zinc-500">
          {ast.description}
        </p>
      </div>

      {/* Selected check */}
      {isSelected && (
        <svg
          className="w-4 h-4 text-blue-500 flex-shrink-0 mt-1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </div>
  );
}
