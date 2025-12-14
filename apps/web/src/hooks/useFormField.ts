// ============================================================================
// useFormField Hook - Persist custom form fields in the AST store
// ============================================================================

import { useCallback } from 'react';
import { useASTStore } from '../stores/astStore';

/**
 * Hook to persist a custom form field in the AST store.
 * Use this for AST-specific fields like policy numbers, dates, etc.
 * 
 * @param key - Unique key for the field
 * @param defaultValue - Default value if not set
 * @returns [value, setValue] tuple
 * 
 * @example
 * const [policyInput, setPolicyInput] = useFormField('policyNumbers', '');
 * const [selectedDate, setSelectedDate] = useFormField('missedRunDate', getDefaultDate());
 */
export function useFormField<T>(key: string, defaultValue: T): [T, (value: T) => void] {
    const activeTabId = useASTStore((state) => state.activeTabId);
    const tabState = useASTStore((state) =>
        activeTabId ? state.tabs[activeTabId] : null
    );
    const setCustomField = useASTStore((state) => state.setCustomField);

    const value = (tabState?.customFields[key] as T) ?? defaultValue;

    const setValue = useCallback(
        (newValue: T) => {
            if (activeTabId) {
                setCustomField(activeTabId, key, newValue);
            }
        },
        [activeTabId, key, setCustomField]
    );

    return [value, setValue];
}
