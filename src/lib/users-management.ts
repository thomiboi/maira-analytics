import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/server'
import { invalidateUserPermissionsCache } from '@/lib/permissions-cache'

export interface CreateUserData {
  email: string
  password: string
  firstName: string
  lastName: string
  roleId: string
  sendWelcomeEmail?: boolean
}

export interface UpdateUserData {
  email?: string
  roleId?: string
}

type RolePermissionEntry = {
  permission: {
    id: string
    name: string
    description?: string | null
    resource?: string
    action?: string
  }
}

export interface UserWithDetails {
  id: string
  email: string
  isActive: boolean
  role: {
    id: string
    name: string
    description: string | null
    permissions: RolePermissionEntry[]
    _count?: {
      users?: number
      permissions?: number
    }
  } | null
  createdAt: Date
  updatedAt: Date
}

export class UserManager {
  
  /**
   * Crear usuario con rol
   */
  static async createUserWithRole(data: CreateUserData): Promise<{
    success: boolean
    user?: UserWithDetails
    error?: string
  }> {
    try {
      // Verificar que el email no existe en la base de datos local
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email }
      })
      
      if (existingUser) {
        return { success: false, error: 'Ya existe un usuario con ese email' }
      }

      // Verificar que el rol existe
      const role = await prisma.role.findUnique({
        where: { id: data.roleId }
      })

      if (!role) {
        return { success: false, error: 'El rol especificado no existe' }
      }

      // Crear usuario en Supabase Auth
      const supabase = await createAdminClient()
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true, // Auto-confirmar el email
        user_metadata: {
          firstName: data.firstName,
          lastName: data.lastName,
          full_name: `${data.firstName} ${data.lastName}`
        }
      })

      if (authError || !authData.user) {
        console.error('Error creating user in Supabase Auth:', authError)
        return { success: false, error: authError?.message || 'Error al crear usuario en el sistema de autenticación' }
      }

      // Crear usuario en la base de datos local
      const newUser = await prisma.user.create({
        data: {
          id: authData.user.id, // Usar el ID de Supabase
          email: data.email,
          roleId: data.roleId
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

      // Opcional: Enviar email de bienvenida
      if (data.sendWelcomeEmail) {
        // Funcionalidad de email puede ser implementada más adelante
        // usando un servicio como SendGrid, Nodemailer, o Supabase Edge Functions
        console.log('Email de bienvenida programado para:', data.email)
      }
      
      return { success: true, user: newUser as UserWithDetails }
    } catch (error) {
      console.error('Error creating user:', error)
      return { success: false, error: 'Error al crear usuario' }
    }
  }

  /**
   * Obtener todos los usuarios con sus roles y permisos
   */
  static async getAllUsers(): Promise<UserWithDetails[]> {
    try {
      return await prisma.user.findMany({
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: {
                    select: {
                      id: true,
                      name: true
                    }
                  }
                },
                orderBy: {
                  permission: {
                    name: 'asc'
                  }
                },
                take: 3
              },
              _count: {
                select: {
                  permissions: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      }) as UserWithDetails[]
    } catch (error) {
      console.error('Error fetching users:', error)
      return []
    }
  }

  /**
   * Obtener usuario por email con sus permisos
   */
  static async getUserWithPermissions(userEmail: string): Promise<UserWithDetails | null> {
    try {
      return await prisma.user.findUnique({
        where: { email: userEmail },
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
      }) as UserWithDetails | null
    } catch (error) {
      console.error('Error fetching user with permissions:', error)
      return null
    }
  }

  /**
   * Obtener usuario por ID
   */
  static async getUserById(userId: string): Promise<UserWithDetails | null> {
    try {
      return await prisma.user.findUnique({
        where: { id: userId },
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
      }) as UserWithDetails | null
    } catch (error) {
      console.error('Error fetching user:', error)
      return null
    }
  }

  /**
   * Asignar rol a usuario
   */
  static async assignRoleToUser(userEmail: string, roleId: string): Promise<{
    success: boolean
    user?: UserWithDetails
    error?: string
  }> {
    try {
      // Verificar que el usuario existe
      const user = await prisma.user.findUnique({
        where: { email: userEmail }
      })

      if (!user) {
        return { success: false, error: 'Usuario no encontrado' }
      }

      // Verificar que el rol existe
      const role = await prisma.role.findUnique({
        where: { id: roleId }
      })

      if (!role) {
        return { success: false, error: 'Rol no encontrado' }
      }

      const updatedUser = await prisma.user.update({
        where: { email: userEmail },
        data: { roleId },
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

      if (userEmail) {
        invalidateUserPermissionsCache(userEmail)
      }
      
      return { success: true, user: updatedUser as UserWithDetails }
    } catch (error) {
      console.error('Error assigning role to user:', error)
      return { success: false, error: 'Error al asignar rol al usuario' }
    }
  }

  /**
   * Actualizar usuario
   */
  static async updateUser(userId: string, data: UpdateUserData): Promise<{
    success: boolean
    user?: UserWithDetails
    error?: string
  }> {
    try {
      const previousUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true }
      })

      if (!previousUser) {
        return { success: false, error: 'Usuario no encontrado' }
      }

      // Si se está cambiando el email, verificar que no existe
      if (data.email) {
        const existingUser = await prisma.user.findFirst({
          where: { 
            email: data.email,
            NOT: { id: userId }
          }
        })
        
        if (existingUser) {
          return { success: false, error: 'Ya existe un usuario con ese email' }
        }
      }

      // Si se está cambiando el rol, verificar que existe
      if (data.roleId) {
        const role = await prisma.role.findUnique({
          where: { id: data.roleId }
        })

        if (!role) {
          return { success: false, error: 'El rol especificado no existe' }
        }
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data,
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

      if (previousUser.email) {
        invalidateUserPermissionsCache(previousUser.email)
      }
      if (updatedUser.email && updatedUser.email !== previousUser.email) {
        invalidateUserPermissionsCache(updatedUser.email)
      }
      
      return { success: true, user: updatedUser as UserWithDetails }
    } catch (error) {
      console.error('Error updating user:', error)
      return { success: false, error: 'Error al actualizar usuario' }
    }
  }

  /**
   * Eliminar usuario
   */
  static async deleteUser(userId: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true }
      })

      if (!user) {
        return { success: false, error: 'Usuario no encontrado' }
      }

      await prisma.user.delete({
        where: { id: userId }
      })

      if (user.email) {
        invalidateUserPermissionsCache(user.email)
      }
      
      return { success: true }
    } catch (error) {
      console.error('Error deleting user:', error)
      return { success: false, error: 'Error al eliminar usuario' }
    }
  }

  /**
   * Obtener usuarios por rol
   */
  static async getUsersByRole(roleId: string): Promise<UserWithDetails[]> {
    try {
      return await prisma.user.findMany({
        where: { roleId },
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
        },
        orderBy: {
          createdAt: 'desc'
        }
      }) as UserWithDetails[]
    } catch (error) {
      console.error('Error fetching users by role:', error)
      return []
    }
  }

  /**
   * Obtener estadísticas de usuarios
   */
  static async getUserStats() {
    try {
      const [totalUsers, usersByRole] = await Promise.all([
        prisma.user.count(),
        prisma.role.findMany({
          include: {
            _count: {
              select: { users: true }
            }
          }
        })
      ])

      return {
        total: totalUsers,
        byRole: usersByRole.map(role => ({
          roleId: role.id,
          roleName: role.name,
          count: role._count.users
        }))
      }
    } catch (error) {
      console.error('Error fetching user stats:', error)
      return {
        total: 0,
        byRole: []
      }
    }
  }

  /**
   * Buscar usuarios por email
   */
  static async searchUsersByEmail(searchTerm: string): Promise<UserWithDetails[]> {
    try {
      return await prisma.user.findMany({
        where: {
          email: {
            contains: searchTerm,
            mode: 'insensitive'
          }
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
        },
        orderBy: {
          email: 'asc'
        },
        take: 20 // Limitar resultados
      }) as UserWithDetails[]
    } catch (error) {
      console.error('Error searching users:', error)
      return []
    }
  }

  /**
   * Sincronizar usuario de Supabase con Prisma
   */
  static async syncUserFromSupabase(supabaseUserId: string, email: string, defaultRoleId?: string): Promise<{
    success: boolean
    user?: UserWithDetails
    error?: string
  }> {
    try {
      // Buscar usuario existente
      let user = await prisma.user.findUnique({
        where: { email },
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

      if (!user) {
        // Si no existe, crear con rol por defecto
        let roleId = defaultRoleId

        if (!roleId) {
          // Buscar el rol 'viewer' como predeterminado
          const defaultRole = await prisma.role.findUnique({
            where: { name: 'viewer' }
          })
          roleId = defaultRole?.id
        }

        if (!roleId) {
          return { success: false, error: 'No se encontró un rol predeterminado para asignar' }
        }

        user = await prisma.user.create({
          data: {
            id: supabaseUserId,
            email,
            roleId
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
      }

      return { success: true, user: user as UserWithDetails }
    } catch (error) {
      console.error('Error syncing user from Supabase:', error)
      return { success: false, error: 'Error al sincronizar usuario' }
    }
  }

  /**
   * Alternar estado activo/inactivo de un usuario
   */
  static async toggleUserStatus(userId: string): Promise<{
    success: boolean
    user?: UserWithDetails
    isActive?: boolean
    error?: string
  }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, isActive: true }
      })

      if (!user) {
        return { success: false, error: 'Usuario no encontrado' }
      }

      const newStatus = !user.isActive

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { isActive: newStatus },
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

      // Invalidar caché de permisos
      if (user.email) {
        invalidateUserPermissionsCache(user.email)
      }

      return { 
        success: true, 
        user: updatedUser as UserWithDetails,
        isActive: newStatus
      }
    } catch (error) {
      console.error('Error toggling user status:', error)
      return { success: false, error: 'Error al cambiar el estado del usuario' }
    }
  }

  /**
   * Desactivar usuario
   */
  static async deactivateUser(userId: string): Promise<{
    success: boolean
    user?: UserWithDetails
    error?: string
  }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true }
      })

      if (!user) {
        return { success: false, error: 'Usuario no encontrado' }
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { isActive: false },
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

      if (user.email) {
        invalidateUserPermissionsCache(user.email)
      }

      return { success: true, user: updatedUser as UserWithDetails }
    } catch (error) {
      console.error('Error deactivating user:', error)
      return { success: false, error: 'Error al desactivar usuario' }
    }
  }

  /**
   * Activar usuario
   */
  static async activateUser(userId: string): Promise<{
    success: boolean
    user?: UserWithDetails
    error?: string
  }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true }
      })

      if (!user) {
        return { success: false, error: 'Usuario no encontrado' }
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { isActive: true },
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

      if (user.email) {
        invalidateUserPermissionsCache(user.email)
      }

      return { success: true, user: updatedUser as UserWithDetails }
    } catch (error) {
      console.error('Error activating user:', error)
      return { success: false, error: 'Error al activar usuario' }
    }
  }
}