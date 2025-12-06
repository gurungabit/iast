// ============================================================================
// Root Layout - TanStack Router
// ============================================================================

import { createRootRoute, Outlet } from '@tanstack/react-router'
import { AuthGuard, Navbar } from '../components'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <AuthGuard>
      <div className="flex flex-col h-screen bg-gray-100 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100">
        <Navbar />
        <Outlet />
      </div>
    </AuthGuard>
  )
}
