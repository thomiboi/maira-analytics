'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

// Hook que sincroniza usuario de Supabase con Prisma
export function useUserSync() {
    const { user, session } = useAuth()
    const [userData, setUserData] = useState(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const syncUser = async () => {
            if (!user || !session) {
                setUserData(null)
                return
            }

            setLoading(true)
            try {
                // Sincronizar usuario con Prisma
                const response = await fetch('/api/users/sync', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({
                        id: user.id,
                        email: user.email
                    })
                })

                if (response.ok) {
                    const data = await response.json()
                    setUserData(data.user)
                }
            } catch (error) {
                console.error('Error syncing user:', error)
            } finally {
                setLoading(false)
            }
        }

        syncUser()
    }, [user, session])

    return {
        userData,
        loading,
        isAuthenticated: !!user
    }
}
