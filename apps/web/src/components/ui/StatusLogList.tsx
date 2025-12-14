// ============================================================================
// StatusLogList Component - Scrollable list of status messages
// ============================================================================

export interface StatusLogListProps {
    /** List of status messages */
    messages: string[];
    /** Maximum height before scrolling */
    maxHeight?: string;
    /** Additional class names */
    className?: string;
}

export function StatusLogList({
    messages,
    maxHeight = '120px',
    className = '',
}: StatusLogListProps): React.ReactNode {
    if (messages.length === 0) {
        return null;
    }

    return (
        <div
            className={`overflow-y-auto text-xs font-mono bg-zinc-900 rounded-md border border-zinc-700 p-2 ${className}`}
            style={{ maxHeight }}
        >
            {messages.map((message, index) => (
                <div
                    key={index}
                    className="py-0.5 text-zinc-400 border-b border-zinc-800 last:border-0"
                >
                    <span className="text-zinc-600 mr-2">{index + 1}.</span>
                    {message}
                </div>
            ))}
        </div>
    );
}
