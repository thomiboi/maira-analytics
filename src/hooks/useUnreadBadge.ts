"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useCallback } from 'react'
import { MessagesService } from '@/services/MessagesService'
import { createClient } from '@/lib/supabase/client'

export function useUnreadBadge() {
    const [count, setCount] = useState<number>(0)
    const supabase = createClient()

    const refresh = useCallback(async () => {
        try {
            const c = await MessagesService.unreadCount()
            setCount(c)
        } catch (e) {
            // ignore
        }
    }, [])

    useEffect(() => {
        void refresh()

        const channel = supabase
            .channel('rt-mensaje-destinatarios')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'mensaje_destinatarios',
            }, () => {
                void refresh()
            })
            .subscribe()

        return () => {
            void supabase.removeChannel(channel)
        }
    }, [supabase, refresh])

    return { count, refresh }
}


