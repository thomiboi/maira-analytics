'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export function useUserStatus() {
  const [isChecking, setIsChecking] = useState(true)
  const [isActive, setIsActive] = useState(true)
  const router = useRouter()
  const { user, signOut } = useAuth()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    // Marcar como montado
    isMountedRef.current = true

    const checkUserStatus = async () => {
      // No verificar si el componente está desmontado
      if (!isMountedRef.current || !user) {
        if (isMountedRef.current) {
          setIsChecking(false)
        }
        return
      }

      try {
        const response = await fetch('/api/user/check-status', {
          // Evitar cache en Vercel
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache'
          }
        })
        
        if (!isMountedRef.current) return

        if (response.ok) {
          const data = await response.json()
          
          if (!isMountedRef.current) return
          
          setIsActive(data.isActive)
          
          if (!data.isActive) {
            // Usuario deshabilitado - cerrar sesión y redirigir
            if (intervalRef.current) {
              clearInterval(intervalRef.current)
              intervalRef.current = null
            }
            await signOut()
            router.push('/login?error=account_disabled')
          }
        }
      } catch (error) {
        if (isMountedRef.current) {
          console.error('Error checking user status:', error)
        }
      } finally {
        if (isMountedRef.current) {
          setIsChecking(false)
        }
      }
    }

    // Primera verificación inmediata
    checkUserStatus()
    
    // Verificar cada 60 segundos (reducido para Vercel)
    // Solo si el usuario existe
    if (user) {
      intervalRef.current = setInterval(() => {
        if (isMountedRef.current) {
          checkUserStatus()
        }
      }, 60000) // 60 segundos
    }
    
    return () => {
      // Marcar como desmontado
      isMountedRef.current = false
      // Limpiar intervalo
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [user, router, signOut])

  return { isActive, isChecking }
}
