"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { usePermissions } from "@/contexts/PermissionsContext";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  BarChart3,
  Star,
  Truck,
  Users,
  Settings,
  Home,
  Pill,
  Menu,
  X,
  MessageCircle,
  BookOpen,
  AlertTriangle,
} from "lucide-react";
import { useUnreadBadge } from "@/hooks/useUnreadBadge";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  resource: string;
  badge?: string;
}

const navigation: NavItem[] = [
  {
    name: "Inicio",
    href: "/",
    icon: Home,
    resource: "home",
  },
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    resource: "dashboard",
  },
  {
    name: "Analytics",
    href: "/dashboard/analytics",
    icon: BarChart3,
    resource: "analytics",
  },
  {
    name: "Ranking",
    href: "/dashboard/ranking",
    icon: Star,
    resource: "ranking",
  },
  {
    name: "Proveedores",
    href: "/dashboard/proveedores",
    icon: Truck,
    resource: "proveedores",
  },
  {
    name: "Alertas Stock",
    href: "/dashboard/stock-alerts",
    icon: AlertTriangle,
    resource: "proveedores",
  },
  {
    name: "Usuarios",
    href: "/dashboard/usuarios",
    icon: Users,
    resource: "usuarios",
  },
  {
    name: "Mensajes",
    href: "/dashboard/mensajes",
    icon: MessageCircle,
    resource: "mensajes",
  },
  {
    name: "API Docs",
    href: "/docs",
    icon: BookOpen,
    resource: "docs",
    badge: "API",
  },
  {
    name: "Configuración",
    href: "/dashboard/configuracion",
    icon: Settings,
    resource: "configuracion",
  },
];

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

export default function Sidebar() {
  const pathname = usePathname();
  const { canAccess, loading } = usePermissions();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { count } = useUnreadBadge();

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  if (loading) {
    return (
      <aside className="flex min-h-screen w-72 flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-colors">
        <div className="border-b border-[var(--border)] p-6">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 animate-pulse rounded-lg bg-gradient-to-r from-red-600 to-red-700 flex-shrink-0" />
            <div className="flex-1">
              <div className="h-8 w-32 animate-pulse rounded bg-[var(--border-muted)]/40" />
            </div>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <span className="text-sm text-[var(--text-subtle)]/70">
            Cargando permisos...
          </span>
        </div>
      </aside>
    );
  }

  const allowedNavigation = navigation.filter((item) => {
    // Siempre permitir acceso a "Inicio" (home)
    if (item.resource === "home") {
      return true;
    }
    return canAccess(item.resource);
  });

  const SidebarContent = () => (
    <>
      <div className="border-b border-[var(--border)] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-red-600 to-red-700 flex-shrink-0">
              <Pill className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <Image
                src="/Logo 600x200.png"
                alt="Farmacias Maira"
                width={150}
                height={50}
                className="h-auto w-auto max-h-10"
                priority
              />
            </div>
          </div>
          {/* Botón cerrar solo en móvil */}
          <button
            onClick={closeMobileMenu}
            className="lg:hidden p-2 rounded-md hover:bg-[var(--surface-muted)] text-[var(--text-subtle)] hover:text-[var(--foreground)]"
            aria-label="Cerrar menú"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>

      <nav className="flex-1 py-6 overflow-y-auto">
        <ul className="space-y-1">
          {allowedNavigation.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  onClick={closeMobileMenu}
                  className={classNames(
                    "flex items-center space-x-3 border-l-2 px-6 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "border-red-600 bg-red-50 text-red-700"
                      : "border-transparent text-[var(--text-subtle)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.name}</span>
                  {item.name === "Mensajes" && count > 0 && (
                    <span className="ml-auto rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">
                      {count}
                    </span>
                  )}
                  {item.badge && item.name !== "Mensajes" && (
                    <span className="ml-auto rounded-full bg-red-100 px-2 py-1 text-xs text-red-700">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {allowedNavigation.length === 0 && (
          <div className="mt-8 px-6">
            <div className="rounded-lg border border-dashed border-[var(--border)] p-4 text-center">
              <p className="text-sm font-medium text-[var(--text-muted)]">
                No tienes permisos asignados
              </p>
              <p className="mt-1 text-xs text-[var(--text-subtle)]">
                Contacta a un administrador para habilitar secciones
              </p>
            </div>
          </div>
        )}
      </nav>
    </>
  );

  return (
    <>
      {/* Botón hamburguesa (solo móvil) - Ajustado para no tapar contenido */}
      <button
        onClick={toggleMobileMenu}
        className="lg:hidden fixed top-4 right-4 z-50 p-2 rounded-md bg-[var(--surface)] border border-[var(--border)] shadow-lg hover:bg-[var(--surface-muted)] text-[var(--foreground)]"
        aria-label="Abrir menú"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Backdrop oscuro (solo móvil cuando está abierto) */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 transition-opacity"
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Desktop (siempre visible) */}
      <aside className="hidden lg:flex min-h-screen w-72 flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-colors">
        <SidebarContent />
      </aside>

      {/* Sidebar Móvil (drawer deslizante) */}
      <aside
        className={classNames(
          "lg:hidden fixed inset-y-0 left-0 z-50 w-72 flex flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-transform duration-300 ease-in-out",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
