"use client";

import React, { useState, useEffect } from "react";
import { usePermissions } from "@/contexts/PermissionsContext";

interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: {
    permission: {
      id: string;
      name: string;
      description: string | null;
      resource: string;
      action: string;
    };
  }[];
  _count: {
    users: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface Permission {
  id: string;
  name: string;
  description: string | null;
  resource: string;
  action: string;
  _count: {
    roles: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: string;
  email: string;
  isActive: boolean;
  role: {
    id: string;
    name: string;
    description: string | null;
    permissions: {
      permission: {
        id: string;
        name: string;
        description?: string | null;
        resource?: string;
        action?: string;
      };
    }[];
    _count?: {
      permissions: number;
    };
  } | null;
  createdAt: string;
  updatedAt: string;
}

type DeleteTarget = {
  type: "user" | "role" | "permission";
  id: string;
  name: string;
};

export default function UsuariosAdminPage() {
  const {
    hasPermission,
    loading: permissionsLoading,
    error: permissionsError,
  } = usePermissions();
  const [activeTab, setActiveTab] = useState<"users" | "roles" | "permissions">(
    "users"
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados para datos
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);

  // Estados para modales
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false);
  const [showEditRoleModal, setShowEditRoleModal] = useState(false);
  const [showManageRolePermissionsModal, setShowManageRolePermissionsModal] =
    useState(false);
  const [showCreatePermissionModal, setShowCreatePermissionModal] =
    useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isUpdatingPermissions, setIsUpdatingPermissions] = useState(false);

  // Estados para formularios y selecciones
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  // Estados para formularios
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    roleId: "",
    sendWelcomeEmail: true,
  });
  const [editUser, setEditUser] = useState({ email: "", roleId: "" });
  const [newRole, setNewRole] = useState({ name: "", description: "" });
  const [editRole, setEditRole] = useState({ name: "", description: "" });
  const [newPermission, setNewPermission] = useState({
    name: "",
    description: "",
    resource: "",
    action: "",
  });
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);

  // Función para cargar datos
  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [usersRes, rolesRes, permissionsRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/roles"),
        fetch("/api/admin/permissions"),
      ]);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users || []);
      }

      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoles(rolesData.roles || []);
      }

      if (permissionsRes.ok) {
        const permissionsData = await permissionsRes.json();
        setPermissions(permissionsData.permissions || []);
      }
    } catch (err) {
      setError("Error al cargar datos");
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Cargar datos iniciales
  useEffect(() => {
    loadData();
  }, []);

  if (permissionsLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center space-y-3 text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600" />
          <p className="text-sm text-gray-600">Verificando permisos...</p>
        </div>
      </div>
    );
  }

  if (permissionsError) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <h2 className="text-lg font-semibold text-red-800">
            Error al cargar permisos
          </h2>
          <p className="mt-2 text-sm text-red-700">{permissionsError}</p>
        </div>
      </div>
    );
  }

  // Verificar permisos
  const canRead = hasPermission("usuarios", "read");
  const canWrite = hasPermission("usuarios", "write");

  if (!canRead && !canWrite) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Acceso Denegado
          </h2>
          <p className="text-gray-600">
            No tienes permisos para acceder a la gestión de usuarios.
          </p>
        </div>
      </div>
    );
  }

  // Funciones para usuarios
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validaciones
    if (newUser.password !== newUser.confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    if (newUser.password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    setIsCreatingUser(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newUser.email,
          password: newUser.password,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          roleId: newUser.roleId,
          sendWelcomeEmail: newUser.sendWelcomeEmail,
        }),
      });

      if (response.ok) {
        await loadData();
        setShowCreateUserModal(false);
        setNewUser({
          email: "",
          password: "",
          confirmPassword: "",
          firstName: "",
          lastName: "",
          roleId: "",
          sendWelcomeEmail: true,
        });
        setError(null); // Limpiar errores anteriores
      } else {
        const errorData = await response.json();
        console.error("Error creating user:", errorData);
        setError(errorData.error || "Error al crear usuario");
      }
    } catch (err) {
      console.error("Error creating user:", err);
      setError("Error de conexión al crear usuario");
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editUser),
      });

      if (response.ok) {
        await loadData();
        setShowEditUserModal(false);
        setSelectedUser(null);
        setEditUser({ email: "", roleId: "" });
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Error al actualizar usuario");
      }
    } catch (err) {
      console.error("Error al actualizar usuario:", err);
      setError("Error al actualizar usuario");
    }
  };

  const openEditUserModal = (user: User) => {
    setSelectedUser(user);
    setEditUser({
      email: user.email,
      roleId: user.role?.id || "",
    });
    setShowEditUserModal(true);
  };

  const handleToggleUserStatus = async (
    userId: string,
    currentStatus: boolean
  ) => {
    const action = currentStatus ? "deshabilitar" : "habilitar";

    if (!confirm(`¿Estás seguro de que deseas ${action} este usuario?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}/toggle-status`, {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        // Actualizar el usuario en el estado local
        setUsers((prevUsers) =>
          prevUsers.map((user) =>
            user.id === userId ? { ...user, isActive: data.isActive } : user
          )
        );
      } else {
        const errorData = await response.json();
        setError(errorData.error || `Error al ${action} usuario`);
      }
    } catch (err) {
      console.error(`Error al ${action} usuario:`, err);
      setError(`Error al ${action} usuario`);
    }
  };

  // Funciones para roles
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRole),
      });

      if (response.ok) {
        await loadData();
        setShowCreateRoleModal(false);
        setNewRole({ name: "", description: "" });
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Error al crear rol");
      }
    } catch (err) {
      console.error("Error al crear rol:", err);
      setError("Error al crear rol");
    }
  };

  const handleEditRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;

    try {
      const response = await fetch(`/api/admin/roles/${selectedRole.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editRole),
      });

      if (response.ok) {
        await loadData();
        setShowEditRoleModal(false);
        setSelectedRole(null);
        setEditRole({ name: "", description: "" });
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Error al actualizar rol");
      }
    } catch (err) {
      console.error("Error al actualizar rol:", err);
      setError("Error al actualizar rol");
    }
  };

  const openEditRoleModal = (role: Role) => {
    setSelectedRole(role);
    setEditRole({
      name: role.name,
      description: role.description || "",
    });
    setShowEditRoleModal(true);
  };

  const openManageRolePermissionsModal = (role: Role) => {
    setSelectedRole(role);
    setRolePermissions(role.permissions.map((rp) => rp.permission.id));
    setShowManageRolePermissionsModal(true);
  };

  const handleManageRolePermissions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;

    setIsUpdatingPermissions(true);
    setError(null);

    try {
      console.log("Sending permissions:", rolePermissions);
      const response = await fetch(
        `/api/admin/roles/${selectedRole.id}/permissions`,
        {
          method: "POST", // Cambiar de PUT a POST
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ permissionIds: rolePermissions }),
        }
      );

      if (response.ok) {
        await loadData();
        setShowManageRolePermissionsModal(false);
        setSelectedRole(null);
        setRolePermissions([]);
        setError(null); // Limpiar errores
      } else {
        const errorData = await response.json();
        console.error("Error updating role permissions:", errorData);
        setError(errorData.error || "Error al actualizar permisos del rol");
      }
    } catch (err) {
      console.error("Error updating role permissions:", err);
      setError("Error al actualizar permisos del rol");
    } finally {
      setIsUpdatingPermissions(false);
    }
  };

  // Funciones para permisos
  const handleCreatePermission = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/admin/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPermission),
      });

      if (response.ok) {
        await loadData();
        setShowCreatePermissionModal(false);
        setNewPermission({
          name: "",
          description: "",
          resource: "",
          action: "",
        });
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Error al crear permiso");
      }
    } catch (err) {
      console.error("Error al crear permiso:", err);
      setError("Error al crear permiso");
    }
  };

  // Función para eliminar
  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      let endpoint: string;
      switch (deleteTarget.type) {
        case "user":
          endpoint = `/api/admin/users/${deleteTarget.id}`;
          break;
        case "role":
          endpoint = `/api/admin/roles/${deleteTarget.id}`;
          break;
        case "permission":
          endpoint = `/api/admin/permissions/${deleteTarget.id}`;
          break;
        default:
          throw new Error("Tipo de elemento no válido");
      }

      const response = await fetch(endpoint, { method: "DELETE" });

      if (response.ok) {
        await loadData();
        setShowDeleteConfirmModal(false);
        setDeleteTarget(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || `Error al eliminar ${deleteTarget.type}`);
      }
    } catch (err) {
      console.error(`Error al eliminar ${deleteTarget?.type}:`, err);
      setError(`Error al eliminar ${deleteTarget?.type}`);
    }
  };

  const openDeleteModal = (
    type: "user" | "role" | "permission",
    id: string,
    name: string
  ) => {
    setDeleteTarget({ type, id, name });
    setShowDeleteConfirmModal(true);
  };

  const getDeleteTargetTypeName = (type: "user" | "role" | "permission") => {
    switch (type) {
      case "user":
        return "usuario";
      case "role":
        return "rol";
      case "permission":
        return "permiso";
      default:
        return "elemento";
    }
  };

  const togglePermissionForRole = (permissionId: string) => {
    console.log(
      "Toggling permission:",
      permissionId,
      "Current permissions:",
      rolePermissions
    );
    setRolePermissions((prev) => {
      const newPermissions = prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId];
      console.log("New permissions:", newPermissions);
      return newPermissions;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Gestión de Usuarios y Permisos
        </h1>
        <p className="text-gray-600">
          Administra usuarios, roles y permisos del sistema
        </p>
      </div>

      {/* Cache Statistics */}
      {/* <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CacheStatsWidget />
        <PerformanceTestWidget />
      </div> */}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="ml-auto -mx-1.5 -my-1.5 bg-red-50 text-red-500 rounded-lg p-1.5 hover:bg-red-100"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            {[
              { id: "users", name: "Usuarios", count: users.length },
              { id: "roles", name: "Roles", count: roles.length },
              {
                id: "permissions",
                name: "Permisos",
                count: permissions.length,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() =>
                  setActiveTab(tab.id as "users" | "roles" | "permissions")
                }
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.name}
                <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs">
                  {tab.count}
                </span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Users Tab */}
          {activeTab === "users" && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-medium text-gray-900">
                  Usuarios del Sistema
                </h2>
                {canWrite && (
                  <button
                    onClick={() => setShowCreateUserModal(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
                  >
                    Crear Usuario
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Usuario
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rol
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Permisos
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha de Registro
                      </th>
                      {canWrite && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Acciones
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => {
                      const previewPermissions = user.role?.permissions ?? [];
                      const totalPermissions =
                        user.role?._count?.permissions ??
                        previewPermissions.length;
                      const remainingPermissions = Math.max(
                        totalPermissions - previewPermissions.length,
                        0
                      );

                      return (
                        <tr
                          key={user.id}
                          className={
                            !user.isActive ? "bg-gray-50 opacity-60" : ""
                          }
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="text-sm font-medium text-gray-900">
                                {user.email}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {user.isActive ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <span className="mr-1">●</span> Activo
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                <span className="mr-1">●</span> Inactivo
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {user.role ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                {user.role.name}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-sm">
                                Sin rol
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1">
                              {previewPermissions.map((rp) => (
                                <span
                                  key={rp.permission.id}
                                  className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800"
                                >
                                  {rp.permission.name}
                                </span>
                              ))}
                              {user.role && remainingPermissions > 0 && (
                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                  +{remainingPermissions} más
                                </span>
                              )}
                              {!user.role && (
                                <span className="text-gray-400 text-sm">
                                  Sin permisos
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(user.createdAt).toLocaleDateString(
                              "es-ES"
                            )}
                          </td>
                          {canWrite && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex items-center space-x-3">
                                <button
                                  onClick={() =>
                                    handleToggleUserStatus(
                                      user.id,
                                      user.isActive
                                    )
                                  }
                                  className={`${
                                    user.isActive
                                      ? "text-orange-600 hover:text-orange-900"
                                      : "text-green-600 hover:text-green-900"
                                  }`}
                                  title={
                                    user.isActive
                                      ? "Deshabilitar usuario"
                                      : "Habilitar usuario"
                                  }
                                >
                                  {user.isActive
                                    ? "🔒 Deshabilitar"
                                    : "✅ Habilitar"}
                                </button>
                                <button
                                  onClick={() => openEditUserModal(user)}
                                  className="text-indigo-600 hover:text-indigo-900"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() =>
                                    openDeleteModal("user", user.id, user.email)
                                  }
                                  className="text-red-600 hover:text-red-900"
                                >
                                  Eliminar
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Roles Tab */}
          {activeTab === "roles" && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-medium text-gray-900">
                  Roles del Sistema
                </h2>
                {canWrite && (
                  <button
                    onClick={() => setShowCreateRoleModal(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
                  >
                    Crear Rol
                  </button>
                )}
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {roles.map((role) => (
                  <div
                    key={role.id}
                    className="border border-gray-200 rounded-lg p-6"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          {role.name}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {role.description}
                        </p>
                      </div>
                      {canWrite && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => openEditRoleModal(role)}
                            className="text-indigo-600 hover:text-indigo-900 text-sm"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() =>
                              openDeleteModal("role", role.id, role.name)
                            }
                            className="text-red-600 hover:text-red-900 text-sm"
                          >
                            Eliminar
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="mb-4">
                      <p className="text-sm text-gray-500">
                        {role._count.users} usuarios asignados
                      </p>
                    </div>

                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        Permisos:
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {role.permissions.slice(0, 3).map((rp) => (
                          <span
                            key={rp.permission.id}
                            className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800"
                          >
                            {rp.permission.name}
                          </span>
                        ))}
                        {role.permissions.length > 3 && (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
                            +{role.permissions.length - 3} más
                          </span>
                        )}
                      </div>
                    </div>

                    {canWrite && (
                      <button
                        onClick={() => openManageRolePermissionsModal(role)}
                        className="w-full bg-gray-100 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-200 text-sm"
                      >
                        Gestionar Permisos
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Permissions Tab */}
          {activeTab === "permissions" && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-medium text-gray-900">
                  Permisos del Sistema
                </h2>
                {canWrite && (
                  <button
                    onClick={() => setShowCreatePermissionModal(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
                  >
                    Crear Permiso
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nombre
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Recurso
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acción
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Roles
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Descripción
                      </th>
                      {canWrite && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Acciones
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {permissions.map((permission) => (
                      <tr key={permission.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {permission.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {permission.resource}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {permission.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {permission._count.roles} roles
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {permission.description || "-"}
                        </td>
                        {canWrite && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() =>
                                openDeleteModal(
                                  "permission",
                                  permission.id,
                                  permission.name
                                )
                              }
                              className="text-red-600 hover:text-red-900"
                            >
                              Eliminar
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modales están aquí pero los voy a continuar en el siguiente mensaje para que el archivo no sea demasiado largo */}

      {/* Modal para crear usuario */}
      {showCreateUserModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-6 border w-full max-w-md shadow-lg rounded-lg bg-white">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">
                Crear Nuevo Usuario
              </h3>
              <button
                onClick={() => {
                  setShowCreateUserModal(false);
                  setNewUser({
                    email: "",
                    password: "",
                    confirmPassword: "",
                    firstName: "",
                    lastName: "",
                    roleId: "",
                    sendWelcomeEmail: true,
                  });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              {/* Nombres */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="firstName"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Nombre *
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    value={newUser.firstName}
                    onChange={(e) =>
                      setNewUser({ ...newUser, firstName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="lastName"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Apellido *
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    value={newUser.lastName}
                    onChange={(e) =>
                      setNewUser({ ...newUser, lastName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="newUserEmail"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Email *
                </label>
                <input
                  id="newUserEmail"
                  type="email"
                  value={newUser.email}
                  onChange={(e) =>
                    setNewUser({ ...newUser, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>

              {/* Contraseña */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Contraseña *
                </label>
                <input
                  id="password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) =>
                    setNewUser({ ...newUser, password: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  minLength={8}
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Mínimo 8 caracteres
                </p>
              </div>

              {/* Confirmar contraseña */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Confirmar Contraseña *
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={newUser.confirmPassword}
                  onChange={(e) =>
                    setNewUser({ ...newUser, confirmPassword: e.target.value })
                  }
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                    newUser.password &&
                    newUser.confirmPassword &&
                    newUser.password !== newUser.confirmPassword
                      ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                      : "border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                  }`}
                  required
                />
                {newUser.password &&
                  newUser.confirmPassword &&
                  newUser.password !== newUser.confirmPassword && (
                    <p className="mt-1 text-xs text-red-600">
                      Las contraseñas no coinciden
                    </p>
                  )}
              </div>

              {/* Rol */}
              <div>
                <label
                  htmlFor="newUserRole"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Rol *
                </label>
                <select
                  id="newUserRole"
                  value={newUser.roleId}
                  onChange={(e) =>
                    setNewUser({ ...newUser, roleId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900"
                  required
                >
                  <option value="" className="text-gray-500">
                    Seleccionar rol
                  </option>
                  {roles.map((role) => (
                    <option
                      key={role.id}
                      value={role.id}
                      className="text-gray-900"
                    >
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Enviar email de bienvenida */}
              <div className="flex items-center">
                <input
                  id="sendWelcomeEmail"
                  type="checkbox"
                  checked={newUser.sendWelcomeEmail}
                  onChange={(e) =>
                    setNewUser({
                      ...newUser,
                      sendWelcomeEmail: e.target.checked,
                    })
                  }
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="sendWelcomeEmail"
                  className="ml-2 block text-sm text-gray-900"
                >
                  Enviar email de bienvenida al usuario
                </label>
              </div>

              {/* Mostrar errores */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* Botones */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  disabled={
                    newUser.password !== newUser.confirmPassword ||
                    !newUser.password ||
                    isCreatingUser
                  }
                  className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isCreatingUser ? "Creando..." : "Crear Usuario"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateUserModal(false);
                    setNewUser({
                      email: "",
                      password: "",
                      confirmPassword: "",
                      firstName: "",
                      lastName: "",
                      roleId: "",
                      sendWelcomeEmail: true,
                    });
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para editar usuario */}
      {showEditUserModal && selectedUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Editar Usuario
              </h3>
              <form onSubmit={handleEditUser}>
                <div className="mb-4">
                  <label
                    htmlFor="editUserEmail"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Email del Usuario
                  </label>
                  <input
                    id="editUserEmail"
                    type="email"
                    value={editUser.email}
                    onChange={(e) =>
                      setEditUser({ ...editUser, email: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label
                    htmlFor="editUserRole"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Rol
                  </label>
                  <select
                    id="editUserRole"
                    value={editUser.roleId}
                    onChange={(e) =>
                      setEditUser({ ...editUser, roleId: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="">Seleccionar rol</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700"
                  >
                    Actualizar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditUserModal(false);
                      setSelectedUser(null);
                      setEditUser({ email: "", roleId: "" });
                    }}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal para crear rol */}
      {showCreateRoleModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Crear Nuevo Rol
              </h3>
              <form onSubmit={handleCreateRole}>
                <div className="mb-4">
                  <label
                    htmlFor="newRoleName"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Nombre del Rol
                  </label>
                  <input
                    id="newRoleName"
                    type="text"
                    value={newRole.name}
                    onChange={(e) =>
                      setNewRole({ ...newRole, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label
                    htmlFor="newRoleDescription"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Descripción
                  </label>
                  <textarea
                    id="newRoleDescription"
                    value={newRole.description}
                    onChange={(e) =>
                      setNewRole({ ...newRole, description: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    rows={3}
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700"
                  >
                    Crear
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateRoleModal(false);
                      setNewRole({ name: "", description: "" });
                    }}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal para editar rol */}
      {showEditRoleModal && selectedRole && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Editar Rol
              </h3>
              <form onSubmit={handleEditRole}>
                <div className="mb-4">
                  <label
                    htmlFor="editRoleName"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Nombre del Rol
                  </label>
                  <input
                    id="editRoleName"
                    type="text"
                    value={editRole.name}
                    onChange={(e) =>
                      setEditRole({ ...editRole, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label
                    htmlFor="editRoleDescription"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Descripción
                  </label>
                  <textarea
                    id="editRoleDescription"
                    value={editRole.description}
                    onChange={(e) =>
                      setEditRole({ ...editRole, description: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    rows={3}
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700"
                  >
                    Actualizar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditRoleModal(false);
                      setSelectedRole(null);
                      setEditRole({ name: "", description: "" });
                    }}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal para gestionar permisos de rol */}
      {showManageRolePermissionsModal && selectedRole && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-2/3 max-w-4xl shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Gestionar Permisos para: {selectedRole.name}
              </h3>
              <form onSubmit={handleManageRolePermissions}>
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-4">
                    Selecciona los permisos que debe tener este rol:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                    {permissions.map((permission) => (
                      <div
                        key={permission.id}
                        className="flex items-center space-x-3 p-3 border rounded-md"
                      >
                        <input
                          type="checkbox"
                          id={`permission-${permission.id}`}
                          checked={rolePermissions.includes(permission.id)}
                          onChange={() =>
                            togglePermissionForRole(permission.id)
                          }
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <label
                          htmlFor={`permission-${permission.id}`}
                          className="flex-1"
                        >
                          <div className="text-sm font-medium text-gray-900">
                            {permission.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {permission.resource}.{permission.action}
                          </div>
                          {permission.description && (
                            <div className="text-xs text-gray-400 mt-1">
                              {permission.description}
                            </div>
                          )}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mostrar errores */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <div className="flex space-x-3">
                  <button
                    type="submit"
                    disabled={isUpdatingPermissions}
                    className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {isUpdatingPermissions
                      ? "Guardando..."
                      : "Guardar Permisos"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowManageRolePermissionsModal(false);
                      setSelectedRole(null);
                      setRolePermissions([]);
                    }}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal para crear permiso */}
      {showCreatePermissionModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Crear Nuevo Permiso
              </h3>
              <form onSubmit={handleCreatePermission}>
                <div className="mb-4">
                  <label
                    htmlFor="newPermissionName"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Nombre del Permiso
                  </label>
                  <input
                    id="newPermissionName"
                    type="text"
                    value={newPermission.name}
                    onChange={(e) =>
                      setNewPermission({
                        ...newPermission,
                        name: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label
                    htmlFor="newPermissionResource"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Recurso
                  </label>
                  <input
                    id="newPermissionResource"
                    type="text"
                    value={newPermission.resource}
                    onChange={(e) =>
                      setNewPermission({
                        ...newPermission,
                        resource: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="ej: usuarios"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label
                    htmlFor="newPermissionAction"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Acción
                  </label>
                  <select
                    id="newPermissionAction"
                    value={newPermission.action}
                    onChange={(e) =>
                      setNewPermission({
                        ...newPermission,
                        action: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="">Seleccionar acción</option>
                    <option value="read">read</option>
                    <option value="write">write</option>
                    <option value="delete">delete</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label
                    htmlFor="newPermissionDescription"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Descripción
                  </label>
                  <textarea
                    id="newPermissionDescription"
                    value={newPermission.description}
                    onChange={(e) =>
                      setNewPermission({
                        ...newPermission,
                        description: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    rows={3}
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700"
                  >
                    Crear
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreatePermissionModal(false);
                      setNewPermission({
                        name: "",
                        description: "",
                        resource: "",
                        action: "",
                      });
                    }}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar */}
      {showDeleteConfirmModal && deleteTarget && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-red-600 mb-4">
                Confirmar Eliminación
              </h3>
              <p className="text-gray-600 mb-6">
                ¿Estás seguro de que quieres eliminar el{" "}
                {getDeleteTargetTypeName(deleteTarget.type)} &quot;
                {deleteTarget.name}&quot;?
              </p>
              <p className="text-sm text-red-500 mb-6">
                Esta acción no se puede deshacer.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={handleDelete}
                  className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700"
                >
                  Eliminar
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirmModal(false);
                    setDeleteTarget(null);
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
