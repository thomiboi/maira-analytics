"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import { useAuth } from "./AuthContext";

interface Permission {
  id: string;
  name: string;
  description?: string;
  resource: string;
  action: string;
}

interface Role {
  id: string;
  name: string;
  description?: string;
}

interface PermissionsContextType {
  permissions: Permission[];
  role: Role | null;
  hasPermission: (resource: string, action?: string) => boolean;
  canAccess: (resource: string) => boolean;
  loading: boolean;
  error: string | null;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(
  undefined
);

export function PermissionsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);
  const currentUserRef = useRef<string | null>(null);

  const fetchUserPermissions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/user/permissions");

      if (!response.ok) {
        throw new Error("Error al obtener permisos del usuario");
      }

      const data = await response.json();
      setPermissions(data.permissions || []);
      setRole(data.role || null);
    } catch (error) {
      console.error("Error fetching permissions:", error);
      setError(error instanceof Error ? error.message : "Error desconocido");
      setPermissions([]);
      setRole(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      // Solo fetch si es un usuario diferente o no hemos hecho fetch antes
      if (currentUserRef.current !== user.email || !fetchedRef.current) {
        currentUserRef.current = user.email || null;
        fetchedRef.current = true;
        fetchUserPermissions();
      }
    } else {
      // Reset cuando no hay usuario
      currentUserRef.current = null;
      fetchedRef.current = false;
      setPermissions([]);
      setRole(null);
      setLoading(false);
    }
  }, [user, fetchUserPermissions]);

  /**
   * Verifica si el usuario tiene un permiso específico
   * @param resource - El recurso (ej: 'dashboard', 'ranking')
   * @param action - La acción (ej: 'read', 'write'). Por defecto 'read'
   */
  const hasPermission = (resource: string, action: string = "read") => {
    return permissions.some(
      (permission) =>
        permission.resource === resource && permission.action === action
    );
  };

  /**
   * Verifica si el usuario puede acceder a un recurso (read o write)
   * @param resource - El recurso a verificar
   */
  const canAccess = (resource: string) => {
    return hasPermission(resource, "read") || hasPermission(resource, "write");
  };

  return (
    <PermissionsContext.Provider
      value={{
        permissions,
        role,
        hasPermission,
        canAccess,
        loading,
        error,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error("usePermissions must be used within a PermissionsProvider");
  }
  return context;
}
