"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { MessagesService, InboxItem, SentItem } from '@/services/MessagesService'

export type MailboxType = 'inbox' | 'archived' | 'sent'

export function useMessages(initialMailbox: MailboxType = 'inbox', refreshKey: number = 0) {
    const [mailbox, setMailbox] = useState<MailboxType>(initialMailbox)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [items, setItems] = useState<InboxItem[] | SentItem[]>([])

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            if (mailbox === 'inbox') {
                const { items } = await MessagesService.fetchInbox()
                setItems(items)
            } else if (mailbox === 'archived') {
                const { items } = await MessagesService.fetchArchived()
                setItems(items)
            } else {
                const { items } = await MessagesService.fetchSent()
                setItems(items)
            }
        } catch (e: any) {
            setError(e?.message || 'Error al cargar mensajes')
        } finally {
            setLoading(false)
        }
    }, [mailbox])

    useEffect(() => {
        void load()
    }, [load, refreshKey]) // Agregar refreshKey como dependencia

    const markRead = useCallback(async (mensajeId: number) => {
        await MessagesService.markRead(mensajeId)
        await load()
    }, [load])

    const archive = useCallback(async (mensajeId: number) => {
        await MessagesService.archive(mensajeId)
        await load()
    }, [load])

    const softDelete = useCallback(async (mensajeId: number) => {
        await MessagesService.softDelete(mensajeId)
        await load()
    }, [load])

    const value = useMemo(() => ({
        mailbox,
        setMailbox,
        items,
        loading,
        error,
        reload: load,
        markRead,
        archive,
        softDelete,
    }), [mailbox, items, loading, error, load, markRead, archive, softDelete])

    return value
}


