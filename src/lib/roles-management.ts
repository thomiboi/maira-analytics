import { prisma } from '@/lib/prisma'
import { invalidatePermissionsForRole } from '@/lib/permissions-cache'

export interface CreateRoleData {
  name: string
  description?: string
  permissions?: string[] // Array de nombres de permisos
}

export interface UpdateRoleData {
  name?: string
  description?: string
}

export interface RoleWithDetails {
  id: string
  name: string
  description: string | null
  permissions: {
    permission: {
      id: string
      name: string
      description: string | null
      resource: string
      action: string
    }
  }[]
  _count: {
    users: number
  }
  createdAt: Date
  updatedAt: Date
}

export class RoleManager {
  
  /**
   * Crear nuevo rol
   */
  static async createRole(data: CreateRoleData): Promise<{
    success: boolean
    role?: RoleWithDetails
    error?: string
  }> {
    try {
      // Verificar que el nombre del rol no existe
      const existingRole = await prisma.role.findUnique({
        where: { name: data.name }
      })
      
      if (existingRole) {
        return { success: false, error: 'Ya existe un rol con ese nombre' }
      }

      const newRole = await prisma.role.create({
        data: {
          name: data.name,
          description: data.description
        }
      })

      // Si se proporcionan permisos, conectarlos
      if (data.permissions && data.permissions.length > 0) {
        const permissionsToConnect = await prisma.permission.findMany({
          where: {
            name: {
              in: data.permissions
            }
          }
        })

        // Crear las relaciones en RolePermission
        await prisma.rolePermission.createMany({
          data: permissionsToConnect.map(permission => ({
            roleId: newRole.id,
            permissionId: permission.id
          }))
        })
      }

      // Obtener el rol con sus permisos
      const roleWithPermissions = await prisma.role.findUnique({
        where: { id: newRole.id },
        include: {
          permissions: {
            include: {
              permission: true
            }
          },
          _count: {
            select: { users: true }
          }
        }
      })
      
      if (!roleWithPermissions) {
        return { success: false, error: 'Error al obtener el rol creado' }
      }
      
      return { success: true, role: roleWithPermissions }
    } catch (error) {
      console.error('Error creating role:', error)
      return { success: false, error: 'Error al crear el rol' }
    }
  }

  /**
   * Obtener todos los roles con sus permisos y conteo de usuarios
   */
  static async getAllRoles(): Promise<RoleWithDetails[]> {
    try {
      return await prisma.role.findMany({
        include: {
          permissions: {
            include: {
              permission: true
            }
          },
          _count: {
            select: { users: true }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      }) as RoleWithDetails[]
    } catch (error) {
      console.error('Error fetching roles:', error)
      return []
    }
  }

  /**
   * Obtener rol por ID
   */
  static async getRoleById(roleId: string): Promise<RoleWithDetails | null> {
    try {
      return await prisma.role.findUnique({
        where: { id: roleId },
        include: {
          permissions: {
            include: {
              permission: true
            }
          },
          _count: {
            select: { users: true }
          }
        }
      }) as RoleWithDetails | null
    } catch (error) {
      console.error('Error fetching role:', error)
      return null
    }
  }

  /**
   * Actualizar rol
   */
  static async updateRole(roleId: string, data: UpdateRoleData): Promise<{
    success: boolean
    role?: RoleWithDetails
    error?: string
  }> {
    try {
      // Si se está cambiando el nombre, verificar que no existe
      if (data.name) {
        const existingRole = await prisma.role.findFirst({
          where: { 
            name: data.name,
            NOT: { id: roleId }
          }
        })
        
        if (existingRole) {
          return { success: false, error: 'Ya existe un rol con ese nombre' }
        }
      }

      const updatedRole = await prisma.role.update({
        where: { id: roleId },
        data,
        include: {
          permissions: {
            include: {
              permission: true
            }
          },
          _count: {
            select: { users: true }
          }
        }
      })

      await invalidatePermissionsForRole(roleId)
      
      return { success: true, role: updatedRole as RoleWithDetails }
    } catch (error) {
      console.error('Error updating role:', error)
      return { success: false, error: 'Error al actualizar el rol' }
    }
  }

  /**
   * Eliminar rol
   */
  static async deleteRole(roleId: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      // Verificar que no hay usuarios asignados
      const usersCount = await prisma.user.count({
        where: { roleId }
      })
      
      if (usersCount > 0) {
        return { 
          success: false, 
          error: `No se puede eliminar. ${usersCount} usuarios tienen este rol.` 
        }
      }
      
      await prisma.role.delete({
        where: { id: roleId }
      })

      await invalidatePermissionsForRole(roleId)
      
      return { success: true }
    } catch (error) {
      console.error('Error deleting role:', error)
      return { success: false, error: 'Error al eliminar el rol' }
    }
  }

  /**
   * Obtener usuarios de un rol
   */
  static async getRoleUsers(roleId: string) {
    try {
      return await prisma.user.findMany({
        where: { roleId },
        select: {
          id: true,
          email: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
    } catch (error) {
      console.error('Error fetching role users:', error)
      return []
    }
  }
}