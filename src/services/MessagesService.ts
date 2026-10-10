/* eslint-disable @typescript-eslint/no-explicit-any */
export type InboxItem = {
    id: number
    asunto: string
    created_at: string
    remitente_email?: string
    remitente_nombre?: string
    leido: boolean
    read_at?: string | null
    archived_at?: string | null
}

export type SentItem = {
    id: number
    asunto: string
    created_at: string
    destinatarios: string[]
}

const jsonHeaders: HeadersInit = {
    'Content-Type': 'application/json',
}

export class MessagesService {
    static async sendMessage(params: { asunto: string; cuerpo: string; destinatarios: string[] }) {
        const res = await fetch('/api/messages/send', {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify(params),
        })
        if (!res.ok) throw new Error((await res.json()).error || 'Error al enviar mensaje')
        return res.json() as Promise<{ id: number }>
    }

    static async fetchInbox(options?: { unread?: boolean; last7?: boolean }): Promise<{ items: InboxItem[] }> {
        const qs = new URLSearchParams()
        if (options?.unread) qs.set('unread', 'true')
        if (options?.last7) qs.set('last7', 'true')
        const res = await fetch(`/api/messages/inbox${qs.toString() ? `?${qs.toString()}` : ''}`, { cache: 'no-store' })
        if (!res.ok) throw new Error((await res.json()).error || 'Error al cargar bandeja de entrada')
        return res.json()
    }

    static async fetchArchived(): Promise<{ items: InboxItem[] }> {
        const res = await fetch('/api/messages/archived', { cache: 'no-store' })
        if (!res.ok) throw new Error((await res.json()).error || 'Error al cargar archivados')
        return res.json()
    }

    static async fetchSent(): Promise<{ items: SentItem[] }> {
        const res = await fetch('/api/messages/sent', { cache: 'no-store' })
        if (!res.ok) throw new Error((await res.json()).error || 'Error al cargar enviados')
        return res.json()
    }

    static async markRead(mensajeId: number): Promise<void> {
        const res = await fetch('/api/messages/mark-read', {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify({ mensajeId }),
        })
        if (!res.ok) throw new Error((await res.json()).error || 'Error al marcar leído')
    }

    static async archive(mensajeId: number): Promise<void> {
        const res = await fetch('/api/messages/archive', {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify({ mensajeId }),
        })
        if (!res.ok) throw new Error((await res.json()).error || 'Error al archivar')
    }

    static async softDelete(mensajeId: number): Promise<void> {
        const res = await fetch('/api/messages/delete', {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify({ mensajeId }),
        })
        if (!res.ok) throw new Error((await res.json()).error || 'Error al eliminar')
    }

    static async unreadCount(): Promise<number> {
        const res = await fetch('/api/messages/unread-count', { cache: 'no-store' })
        if (!res.ok) throw new Error((await res.json()).error || 'Error al obtener no leídos')
        const data = await res.json()
        return data.no_leidos ?? 0
    }

    static async userSearch(q: string): Promise<{ id: string; label: string; email?: string }[]> {
        const qs = new URLSearchParams({ q })
        const res = await fetch(`/api/messages/users-search?${qs.toString()}`, { cache: 'no-store' })
        if (!res.ok) throw new Error((await res.json()).error || 'Error al buscar usuarios')
        const data = await res.json()
        return data.items ?? []
    }
}



