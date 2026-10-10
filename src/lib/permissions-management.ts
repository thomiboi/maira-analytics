import { prisma } from '@/lib/prisma'
import { invalidateAllPermissionsCache, invalidatePermissionsForRole } from '@/lib/permissions-cache'

export interface CreatePermissionData {
  name: string
  description?: string
  resource: string
  action: string
}

export interface UpdatePermissionData {
  name?: string
  description?: string
  resource?: string
  action?: string
}

export interface PermissionWithDetails {
  id: string
  name: string
  description: string | null
  resource: string
  action: string
  _count: {
    roles: number
  }
  createdAt: Date
  updatedAt: Date
}

export class PermissionManager {
  
  /**
   * Crear nuevo permiso
   */
  static async createPermission(data: CreatePermissionData): Promise<{
    success: boolean
    permission?: PermissionWithDetails
    error?: string
  }> {
    try {
      // Verificar que el nombre del permiso no existe
      const existingPermission = await prisma.permission.findUnique({
        where: { name: data.name }
      })
      
      if (existingPermission) {
        return { success: false, error: 'Ya existe un permiso con ese nombre' }
      }

      const newPermission = await prisma.permission.create({
        data: {
          name: data.name,
          description: data.description,
          resource: data.resource,
          action: data.action
        },
        include: {
          _count: {
            select: { roles: true }
          }
        }
      })

      invalidateAllPermissionsCache()
      
      return { success: true, permission: newPermission }
    } catch (error) {
      console.error('Error creating permission:', error)
      return { success: false, error: 'Error al crear el permiso' }
    }
  }

  /**
   * Obtener todos los permisos
   */
  static async getAllPermissions(): Promise<PermissionWithDetails[]> {
    try {
      return await prisma.permission.findMany({
        include: {
          _count: {
            select: { roles: true }
          }
        },
        orderBy: {
          resource: 'asc'
        }
      }) as PermissionWithDetails[]
    } catch (error) {
      console.error('Error fetching permissions:', error)
      return []
    }
  }

  /**
   * Obtener permiso por ID
   */
  static async getPermissionById(permissionId: string): Promise<PermissionWithDetails | null> {
    try {
      return await prisma.permission.findUnique({
        where: { id: permissionId },
        include: {
          _count: {
            select: { roles: true }
          }
        }
      }) as PermissionWithDetails | null
    } catch (error) {
      console.error('Error fetching permission:', error)
      return null
    }
  }

  /**
   * Actualizar permiso
   */
  static async updatePermission(permissionId: string, data: UpdatePermissionData): Promise<{
    success: boolean
    permission?: PermissionWithDetails
    error?: string
  }> {
    try {
      // Si se está cambiando el nombre, verificar que no existe
      if (data.name) {
        const existingPermission = await prisma.permission.findFirst({
          where: { 
            name: data.name,
            NOT: { id: permissionId }
          }
        })
        
        if (existingPermission) {
          return { success: false, error: 'Ya existe un permiso con ese nombre' }
        }
      }

      const updatedPermission = await prisma.permission.update({
        where: { id: permissionId },
        data,
        include: {
          _count: {
            select: { roles: true }
          }
        }
      })

      invalidateAllPermissionsCache()
      
      return { success: true, permission: updatedPermission as PermissionWithDetails }
    } catch (error) {
      console.error('Error updating permission:', error)
      return { success: false, error: 'Error al actualizar el permiso' }
    }
  }

  /**
   * Eliminar permiso
   */
  static async deletePermission(permissionId: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      // Verificar que no hay roles asignados
      const rolesCount = await prisma.rolePermission.count({
        where: { permissionId }
      })
      
      if (rolesCount > 0) {
        return { 
          success: false, 
          error: `No se puede eliminar. ${rolesCount} roles tienen este permiso.` 
        }
      }
      
      await prisma.permission.delete({
        where: { id: permissionId }
      })

      invalidateAllPermissionsCache()
      
      return { success: true }
    } catch (error) {
      console.error('Error deleting permission:', error)
      return { success: false, error: 'Error al eliminar el permiso' }
    }
  }

  /**
   * Asignar permiso a rol
   */
  static async assignPermissionToRole(roleId: string, permissionId: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      // Verificar que la relación no existe
      const existingRelation = await prisma.rolePermission.findFirst({
        where: {
          roleId,
          permissionId
        }
      })

      if (existingRelation) {
        return { success: false, error: 'El permiso ya está asignado a este rol' }
      }

      await prisma.rolePermission.create({
        data: {
          roleId,
          permissionId
        }
      })

      await invalidatePermissionsForRole(roleId)
      
      return { success: true }
    } catch (error) {
      console.error('Error assigning permission:', error)
      return { success: false, error: 'Error al asignar permiso' }
    }
  }

  /**
   * Remover permiso de rol
   */
  static async removePermissionFromRole(roleId: string, permissionId: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      await prisma.rolePermission.deleteMany({
        where: {
          roleId,
          permissionId
        }
      })

      await invalidatePermissionsForRole(roleId)
      
      return { success: true }
    } catch (error) {
      console.error('Error removing permission:', error)
      return { success: false, error: 'Error al remover permiso' }
    }
  }

  /**
   * Actualizar permisos de un rol (reemplazar todos)
   */
  static async updateRolePermissions(roleId: string, permissionIds: string[]): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      // Eliminar todos los permisos existentes del rol
      await prisma.rolePermission.deleteMany({
        where: { roleId }
      })

      // Agregar los nuevos permisos
      if (permissionIds.length > 0) {
        await prisma.rolePermission.createMany({
          data: permissionIds.map(permissionId => ({
            roleId,
            permissionId
          }))
        })
      }

      await invalidatePermissionsForRole(roleId)
      
      return { success: true }
    } catch (error) {
      console.error('Error updating role permissions:', error)
      return { success: false, error: 'Error al actualizar permisos' }
    }
  }

  /**
   * Obtener roles de un permiso
   */
  static async getPermissionRoles(permissionId: string) {
    try {
      return await prisma.rolePermission.findMany({
        where: { permissionId },
        include: {
          role: {
            select: {
              id: true,
              name: true,
              description: true,
              createdAt: true,
              updatedAt: true
            }
          }
        },
        orderBy: {
          role: {
            name: 'asc'
          }
        }
      })
    } catch (error) {
      console.error('Error fetching permission roles:', error)
      return []
    }
  }

  /**
   * Obtener permisos disponibles por recurso
   */
  static async getPermissionsByResource(resource: string): Promise<PermissionWithDetails[]> {
    try {
      return await prisma.permission.findMany({
        where: { resource },
        include: {
          _count: {
            select: { roles: true }
          }
        },
        orderBy: {
          action: 'asc'
        }
      }) as PermissionWithDetails[]
    } catch (error) {
      console.error('Error fetching permissions by resource:', error)
      return []
    }
  }

  /**
   * Obtener todos los recursos únicos
   */
  static async getUniqueResources(): Promise<string[]> {
    try {
      const result = await prisma.permission.findMany({
        select: {
          resource: true
        },
        distinct: ['resource'],
        orderBy: {
          resource: 'asc'
        }
      })
      
      return result.map(p => p.resource)
    } catch (error) {
      console.error('Error fetching unique resources:', error)
      return []
    }
  }

  /**
   * Obtener todas las acciones únicas
   */
  static async getUniqueActions(): Promise<string[]> {
    try {
      const result = await prisma.permission.findMany({
        select: {
          action: true
        },
        distinct: ['action'],
        orderBy: {
          action: 'asc'
        }
      })
      
      return result.map(p => p.action)
    } catch (error) {
      console.error('Error fetching unique actions:', error)
      return []
    }
  }
}