// ============================================================================
// Root Layout - TanStack Router
// ============================================================================

import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { ASTProvider } from '../providers/ASTProvider'
import { AuthGuard } from '../components/AuthGuard'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <ASTProvider>
      <AuthGuard>
        <Outlet />
      </AuthGuard>
      <TanStackRouterDevtools position="bottom-right" />
    </ASTProvider>
  )
}
