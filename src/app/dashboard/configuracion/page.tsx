'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme, type ThemePreference } from '@/contexts/ThemeContext'
import { usePermissions } from '@/contexts/PermissionsContext'
import { useRouter } from 'next/navigation'

const themeOptions: Array<{
  value: ThemePreference
  label: string
  description: string
  icon: typeof Monitor
}> = [
  {
    value: 'system',
    label: 'Predeterminado del sistema',
    description: 'Detecta automáticamente el esquema de color de tu navegador u OS.',
    icon: Monitor
  },
  {
    value: 'light',
    label: 'Tema claro',
    description: 'Ideal para ambientes luminosos con enfoque en fondos blancos.',
    icon: Sun
  },
  {
    value: 'dark',
    label: 'Tema oscuro',
    description: 'Protege la vista en ambientes con poca luz y ahorra energía.',
    icon: Moon
  }
]

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

export default function ConfiguracionPage() {
  const { preference, theme, setPreference } = useTheme();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const router = useRouter();

  // Verificar permisos de lectura
  const canReadConfiguracion = hasPermission('configuracion', 'read');

  // Mostrar loading mientras se cargan permisos
  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Verificando permisos...</p>
        </div>
      </div>
    );
  }

  // Verificar si tiene permisos de lectura
  if (!canReadConfiguracion) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Acceso Restringido
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            No tienes permisos para acceder a la configuración.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm transition-colors">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-red-600 dark:text-red-300">
            Personalización
          </p>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Preferencias de apariencia</h1>
          <p className="text-sm text-[var(--text-subtle)]">
            Ajusta la apariencia del panel para que coincida con tus preferencias o deja que el sistema la elija por ti.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {themeOptions.map((option) => {
            const isActive = preference === option.value
            const Icon = option.icon

            return (
              <label
                key={option.value}
                className={classNames(
                  'flex cursor-pointer flex-col gap-4 rounded-2xl border p-5 transition-shadow focus-within:outline-none focus-within:ring-2 focus-within:ring-red-500',
                  isActive
                    ? 'border-red-600 bg-red-50 shadow-sm dark:border-red-500 dark:bg-red-500/10'
                    : 'border-gray-200 hover:border-red-200 hover:shadow-sm dark:border-slate-700 dark:hover:border-red-500/50'
                )}
              >
                <div className={classNames(
                  'flex h-12 w-12 items-center justify-center rounded-xl text-red-600 transition-colors dark:text-red-300',
                  isActive ? 'bg-white shadow-sm dark:bg-slate-900' : 'bg-red-50 dark:bg-red-500/10'
                )}>
                  <Icon className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-base font-semibold text-[var(--foreground)]">{option.label}</p>
                  <p className="mt-1 text-sm text-[var(--text-subtle)]">{option.description}</p>
                </div>

                <input
                  type="radio"
                  name="theme-option"
                  value={option.value}
                  checked={isActive}
                  onChange={() => setPreference(option.value)}
                  className="sr-only"
                />
              </label>
            )
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm transition-colors">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Estado del tema</h2>
            <p className="text-sm text-[var(--text-subtle)]">
              Actualmente el panel muestra el modo <span className="font-semibold text-[var(--foreground)]">{theme === 'dark' ? 'oscuro' : 'claro'}</span>.
            </p>
          </div>
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-5 py-3 text-sm text-[var(--text-muted)]">
            Preferencia seleccionada: <span className="font-medium capitalize">{preference}</span>
          </div>
        </div>
        <p className="mt-4 text-xs text-[var(--text-subtle)]">
          El modo automático sincroniza la interfaz con el <span className="font-semibold">tema del navegador</span> y responde a cambios inmediatos del sistema operativo.
        </p>
      </section>
    </div>
  )
}
