"use client";

import { useEffect, useRef, useState } from "react";
import { User, LogOut, ShieldCheck, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import NotificationBell from "@/components/notifications/NotificationBell";

export default function DashboardHeader() {
  const { user, signOut } = useAuth();
  const { role } = usePermissions();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setMenuOpen(false);
    window.location.href = "/login";
  };

  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)] px-6 py-4 transition-colors">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Maira Analytics
          </h1>
          <p className="text-sm text-[var(--text-subtle)]">
            Supervisión inteligente para Farmacias Maira.
          </p>
        </div>

        <div className="flex items-center gap-4 lg:justify-end">
          {/* Campana de notificaciones */}
          <NotificationBell />

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-[var(--foreground)] transition-colors hover:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white dark:bg-red-500">
                {user?.email ? (
                  <span className="text-sm font-semibold">
                    {user.email.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <User className="h-5 w-5" />
                )}
              </div>
              <div className="flex flex-col">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {user?.email ?? "Sin usuario"}
                </p>
                <p className="flex items-center gap-2 text-xs text-[var(--text-subtle)]">
                  Sesión activa
                  {role && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-200">
                      <ShieldCheck className="h-3 w-3" />
                      <span className="capitalize">{role.name}</span>
                    </span>
                  )}
                </p>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-[var(--text-subtle)] transition-transform ${
                  menuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-14 w-64 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--foreground)] shadow-xl">
                <div className="border-b border-[var(--border)] pb-3">
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {user?.email ?? "Sin usuario"}
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-[var(--text-subtle)]">
                    Sesión activa
                    {role && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-200">
                        <ShieldCheck className="h-3 w-3" />
                        <span className="capitalize">{role.name}</span>
                      </span>
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-muted)] transition-colors hover:border-red-500 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:hover:border-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
