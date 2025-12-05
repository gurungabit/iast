// ============================================================================
// Tab Bar Component
// ============================================================================

import { STATUS_TABS, type TabFilter } from './types'

interface TabBarProps {
  activeTab: TabFilter
  onTabChange: (tab: TabFilter) => void
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <div className="flex flex-wrap gap-1 p-1 bg-gray-100 dark:bg-zinc-800/50 rounded-lg">
      {STATUS_TABS.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onTabChange(id)}
          className={`
            cursor-pointer px-2 py-1 text-xs font-medium rounded-md transition-all duration-200 whitespace-nowrap
            ${activeTab === id
              ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 shadow-sm'
              : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200'
            }
          `}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
