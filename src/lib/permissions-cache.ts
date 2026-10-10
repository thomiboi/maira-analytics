import { LRUCache } from 'lru-cache'
import { prisma } from './prisma'

// Tipos para el caché
interface CachedUserPermissions {
  permissions: Array<{
    id: string
    name: string
    resource: string
    action: string
  }>
  role: {
    id: string
    name: string
    description: string | null
  } | null
  cachedAt: number
}

// Tipo para los datos de permisos que vienen de Prisma
interface RolePermissionWithPermission {
  permission: {
    id: string
    name: string
    description: string | null
    resource: string
    action: string
  }
}

// Configuración del caché LRU
const permissionsCache = new LRUCache<string, CachedUserPermissions>({
  max: 1000, // Máximo 1000 usuarios en caché
  ttl: 1000 * 60 * 60, // TTL de 60 minutos (se invalida al modificar roles/permisos)
  allowStale: false,
  updateAgeOnGet: false,
  updateAgeOnHas: false,
})

/**
 * Obtiene permisos de usuario desde la base de datos (función pura)
 */
async function fetchUserPermissionsFromDB(email: string): Promise<CachedUserPermissions | null> {
  try {
    const dbUser = await prisma.user.findUnique({
      where: { 
        email: email 
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true
              }
            }
          }
        }
      }
    })

    if (!dbUser) {
      return null
    }

    // Extraer los permisos del usuario con tipos seguros
    const permissions = dbUser.role?.permissions.map((rp: RolePermissionWithPermission) => ({
      id: rp.permission.id,
      name: rp.permission.name,
      resource: rp.permission.resource,
      action: rp.permission.action
    })) || []

    // Información del rol
    const roleInfo = dbUser.role ? {
      id: dbUser.role.id,
      name: dbUser.role.name,
      description: dbUser.role.description
    } : null

    return {
      permissions,
      role: roleInfo,
      cachedAt: Date.now()
    }

  } catch (error) {
    console.error('Error fetching user permissions from DB:', error)
    return null
  }
}

/**
 * Obtiene permisos de usuario con caché inteligente
 */
export async function getCachedUserPermissions(email: string): Promise<CachedUserPermissions | null> {
  // Intentar obtener del caché primero
  const cached = permissionsCache.get(email)
  
  if (cached) {
    console.log(`[CACHE HIT] Permisos encontrados en caché para: ${email}`)
    return cached
  }

  // Si no está en caché, consultar la base de datos
  console.log(`[CACHE MISS] Consultando DB para permisos de: ${email}`)
  const fresh = await fetchUserPermissionsFromDB(email)
  
  if (fresh) {
    // Guardar en caché
    permissionsCache.set(email, fresh)
    console.log(`[CACHE SET] Permisos guardados en caché para: ${email}`)
  }
  
  return fresh
}

/**
 * Verifica si un usuario tiene un permiso específico (con caché)
 */
export async function hasUserPermissionCached(
  email: string, 
  resource: string, 
  action: string = 'read'
): Promise<boolean> {
  const userPerms = await getCachedUserPermissions(email)
  
  if (!userPerms) {
    return false
  }

  return userPerms.permissions.some(p => 
    p.resource === resource && p.action === action
  )
}

/**
 * Invalida el caché para un usuario específico
 */
export function invalidateUserPermissionsCache(email: string): boolean {
  return permissionsCache.delete(email)
}

/**
 * Invalida todo el caché de permisos (usar cuando se cambien roles/permisos globalmente)
 */
export function invalidateAllPermissionsCache(): void {
  permissionsCache.clear()
  console.log('[CACHE CLEAR] Todo el caché de permisos ha sido limpiado')
}

export function invalidatePermissionsForEmails(emails: string[]): void {
  const uniqueEmails = new Set(emails.filter(Boolean))

  uniqueEmails.forEach((email) => {
    const removed = invalidateUserPermissionsCache(email)
    if (removed) {
      console.log(`[CACHE INVALIDATE] Caché removido para: ${email}`)
    }
  })
}

export async function invalidatePermissionsForRole(roleId: string): Promise<void> {
  const users = await prisma.user.findMany({
    where: { roleId },
    select: { email: true }
  })

  invalidatePermissionsForEmails(users.map((user) => user.email ?? '').filter(Boolean))
}

/**
 * Obtiene estadísticas del caché
 */
export function getCacheStats() {
  return {
    size: permissionsCache.size,
    maxSize: permissionsCache.max,
    hitRatio: `${((permissionsCache.calculatedSize || 0) / (permissionsCache.size || 1) * 100).toFixed(2)}%`,
    remainingTTL: `${Math.round((permissionsCache.ttl || 0) / 1000 / 60)} minutos`
  }
}

/**
 * Pre-carga permisos para un usuario (útil para optimización proactiva)
 */
export async function preloadUserPermissions(email: string): Promise<void> {
  if (!permissionsCache.has(email)) {
    await getCachedUserPermissions(email)
  }
}