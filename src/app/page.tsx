"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PermissionsProvider } from "@/contexts/PermissionsContext";
import Sidebar from "@/components/Sidebar";
import DashboardHeader from "@/components/DashboardHeader";
import WelcomeBanner from "@/components/home/WelcomeBanner";
import QuickActions from "@/components/home/QuickActions";
import NotificationWidget from "@/components/home/NotificationWidget";
import TopProducts from "@/components/home/TopProducts";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-600 mx-auto mb-4"></div>
          <div className="text-lg text-[var(--foreground)]">Cargando...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <PermissionsProvider>
      <div className="flex h-screen bg-[var(--background)]">
        {/* Sidebar */}
        <Sidebar />
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <DashboardHeader />
          
          {/* Main content area */}
          <main className="flex-1 overflow-auto p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              {/* Welcome Banner */}
              <WelcomeBanner userName={user.email?.split('@')[0] || 'Usuario'} />
              
              {/* Quick Actions */}
              <QuickActions />

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Products */}
                <TopProducts />

                {/* Notifications */}
                <NotificationWidget />
              </div>
            </div>
          </main>
        </div>
      </div>
    </PermissionsProvider>
  );
}
