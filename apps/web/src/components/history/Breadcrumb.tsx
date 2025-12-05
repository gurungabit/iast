// ============================================================================
// Breadcrumb Component
// ============================================================================

interface BreadcrumbItem {
  label: string
  onClick?: () => void
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2">
          {idx > 0 && <span className="text-gray-400 dark:text-zinc-600">/</span>}
          {item.onClick ? (
            <button
              onClick={item.onClick}
              className="cursor-pointer text-blue-600 dark:text-blue-400 hover:underline"
            >
              {item.label}
            </button>
          ) : (
            <span className="text-gray-700 dark:text-zinc-300 font-medium">{item.label}</span>
          )}
        </div>
      ))}
    </div>
  )
}
