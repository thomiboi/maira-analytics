'use client'

import { PermissionsProvider } from '@/contexts/PermissionsContext'
import Sidebar from '@/components/Sidebar'
import DashboardHeader from '@/components/DashboardHeader'
import { useUserStatus } from '@/hooks/useUserStatus'

interface DashboardLayoutProps {
  children: React.ReactNode
}

function DashboardContent({ children }: Readonly<DashboardLayoutProps>) {
  const { isActive, isChecking } = useUserStatus()

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600 mx-auto" />
          <p className="mt-4 text-sm text-gray-600">Verificando acceso...</p>
        </div>
      </div>
    )
  }

  if (!isActive) {
    return null // El hook redirigirá al login
  }

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <Sidebar />

      <div className="flex min-h-screen flex-1 flex-col overflow-hidden">
        <DashboardHeader />

        <main className="flex-1 overflow-auto bg-[var(--background)] p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: Readonly<DashboardLayoutProps>) {
  return (
    <PermissionsProvider>
      <DashboardContent>{children}</DashboardContent>
    </PermissionsProvider>
  )
}