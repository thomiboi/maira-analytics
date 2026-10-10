"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
}

interface UserPermissions {
  permissions: Permission[];
  role: {
    id: string;
    name: string;
    description: string | null;
  } | null;
}

/**
 * Hook para verificar permisos del usuario en el cliente.
 * 
 * Uso:
 * ```tsx
 * const { hasPermission, loading, permissions } = usePermissions();
 * 
 * if (loading) return <Loading />;
 * if (!hasPermission('dashboard', 'read')) return <NoAccess />;
 * ```
 */
export function usePermissions() {
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPermissions() {
      try {
        const response = await fetch('/api/user/permissions', {
          method: 'GET',
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch permissions');
        }

        const data = await response.json();
        setPermissions(data);
      } catch (err) {
        console.error('Error fetching permissions:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchPermissions();
  }, []);

  const hasPermission = (resource: string, action: string = 'read'): boolean => {
    if (!permissions) return false;
    
    return permissions.permissions.some(
      (p) => p.resource === resource && p.action === action
    );
  };

  return {
    permissions,
    loading,
    error,
    hasPermission,
    role: permissions?.role,
  };
}

/**
 * Hook que redirige automáticamente si el usuario no tiene el permiso requerido.
 * 
 * Uso:
 * ```tsx
 * // En el componente de la página
 * useRequirePermission('proveedores', 'read');
 * ```
 */
export function useRequirePermission(resource: string, action: string = 'read') {
  const { hasPermission, loading } = usePermissions();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !hasPermission(resource, action)) {
      router.push('/dashboard?error=sin-permisos');
    }
  }, [loading, hasPermission, resource, action, router]);

  return { loading, hasPermission: hasPermission(resource, action) };
}
