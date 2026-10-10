"use client";

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import { MessageComposer } from '@/components/messages/MessageComposer'
import { MessageList } from '@/components/messages/MessageList'
import { Loader2 } from 'lucide-react'

export default function MensajesPage() {
    const [refreshKey, setRefreshKey] = useState(0)
    const { hasPermission, loading: permissionsLoading } = usePermissions()
    const router = useRouter()

    const handleSent = () => {
        // Forzar re-render de la lista de mensajes
        setRefreshKey(prev => prev + 1)
    }

    // Verificar permisos
    if (permissionsLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <Loader2 className="animate-spin h-12 w-12 text-red-600 mx-auto mb-4" />
                    <p className="text-[var(--text-subtle)]">Verificando permisos...</p>
                </div>
            </div>
        )
    }

    const canReadMensajes = hasPermission('mensajes', 'read')
    const canWriteMensajes = hasPermission('mensajes', 'write')

    if (!canReadMensajes) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center max-w-md">
                    <div className="text-6xl mb-4">🔒</div>
                    <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">
                        Acceso Restringido
                    </h2>
                    <p className="text-[var(--text-subtle)] mb-6">
                        No tienes permisos para acceder a la mensajería interna.
                    </p>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                        Volver al Dashboard
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">Mensajería Interna</h1>
                <p className="text-[var(--text-subtle)]">Envía y gestiona mensajes con otros usuarios del sistema</p>
            </div>
            
            {canWriteMensajes && <MessageComposer onSent={handleSent} />}
            
            <MessageList key={refreshKey} mailbox="inbox" />
        </div>
    )
}


