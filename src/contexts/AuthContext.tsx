"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { User, Session, AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const supabase = createClient();

  const warmPermissionsCache = useCallback(async () => {
    try {
      await fetch('/api/user/permissions', {
        method: 'GET',
        cache: 'no-store'
      });
    } catch (error) {
      console.warn('No se pudo precargar los permisos del usuario:', error);
    }
  }, []);

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      setInitialized(true);

      if (session?.user?.email) {
        void warmPermissionsCache();
      }
    };

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Evitar re-renderizados innecesarios en TOKEN_REFRESHED
      if (event === 'TOKEN_REFRESHED' && initialized) {
        // Solo actualizar la sesión, no cambiar loading ni user si ya están establecidos
        if (session?.user?.id === user?.id) {
          setSession(session);
          return;
        }
      }

      setSession(session);
      setUser(session?.user ?? null);
      
      // Solo cambiar loading en la primera carga o cambios reales de usuario
      if (!initialized || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        setLoading(false);
      }
      
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user?.email) {
        void warmPermissionsCache();
      }

      // Log para debugging
      if (event === 'SIGNED_OUT') {
        console.log('[AUTH] Usuario cerró sesión - caché será limpiado');
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth, warmPermissionsCache, initialized, user?.id]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error: authError, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      return { error: authError };
    }

    // Verificar si el usuario está activo después de autenticarse
    if (data.session && data.user) {
      try {
        console.log('🔍 [AUTH] Verificando estado del usuario:', data.user.email);
        
        // Esperar un poco para que la sesión se establezca
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const statusResponse = await fetch('/api/user/check-status', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          },
          credentials: 'include'
        });
        
        console.log('📡 [AUTH] Respuesta del servidor:', statusResponse.status);
        
        // Parsear la respuesta siempre (sea 200, 404, etc)
        const responseData = await statusResponse.json();
        console.log('📊 [AUTH] Datos recibidos:', responseData);
        
        // Verificar isActive - puede venir en respuesta 200 o 404
        const { isActive } = responseData;
        
        if (isActive === false) {
          // Usuario deshabilitado o no encontrado - cerrar sesión inmediatamente
          console.log('❌ [AUTH] Usuario deshabilitado o no encontrado, cerrando sesión');
          await supabase.auth.signOut();
          return { 
            error: { 
              message: responseData.error || 'Tu cuenta ha sido deshabilitada. Contacta al administrador.',
              name: 'AccountDisabledError',
              status: 403
            } as AuthError
          };
        }
        
        // Si llegamos aquí y el status no es ok, también bloquear
        if (!statusResponse.ok) {
          console.error('❌ [AUTH] Error en respuesta del servidor:', statusResponse.status);
          await supabase.auth.signOut();
          return {
            error: {
              message: responseData.error || 'Error al verificar el estado de la cuenta.',
              name: 'StatusCheckError',
              status: statusResponse.status
            } as AuthError
          };
        }
        
        console.log('✅ [AUTH] Usuario activo, permitiendo acceso');
      } catch (error) {
        console.error('❌ [AUTH] Error verificando estado del usuario:', error);
        // Si hay error al verificar, por seguridad cerramos sesión
        await supabase.auth.signOut();
        return {
          error: {
            message: 'Error al verificar el estado de la cuenta.',
            name: 'StatusCheckError',
            status: 500
          } as AuthError
        };
      }
      
      await warmPermissionsCache();
    }

    return { error: null };
  }, [supabase, warmPermissionsCache]);

  const signOut = useCallback(async () => {
    try {
      // Limpiar caché de permisos del usuario antes del logout
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.warn('Error al limpiar caché en logout:', error);
    } finally {
      // Siempre hacer logout, incluso si la limpieza de caché falla
      await supabase.auth.signOut();
    }
  }, [supabase]);

  const value = useMemo(() => ({
    user,
    session,
    loading,
    signIn,
    signOut,
  }), [user, session, loading, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
