"use client";

import type { ProductStats } from "@/types/supplier";
import { Package, RefreshCw, DollarSign, Building } from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface ProductStatsProps {
  readonly stats: ProductStats;
}

export default function ProductStats({ stats }: Readonly<ProductStatsProps>) {
  const statCards = [
    {
      title: "Total Productos",
      value: stats.totalProducts,
      icon: Package,
      color: "bg-blue-500",
    },
    {
      title: "Con Múltiples Proveedores",
      value: stats.productsWithMultipleSuppliers,
      icon: RefreshCw,
      color: "bg-purple-500",
    },
    {
      title: "Diferencia Promedio",
      value: formatPrice(stats.averagePriceDifference ?? 0),
      icon: DollarSign,
      color: "bg-yellow-500",
    },
    {
      title: "Total Proveedores",
      value: stats.totalSuppliers,
      icon: Building,
      color: "bg-green-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
      {statCards.map((stat) => (
        <div
          key={stat.title}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center mb-2">
            <stat.icon className="w-6 h-6 text-[var(--text-muted)]" />
          </div>
          <h3 className="text-[var(--text-muted)] text-sm mb-1">
            {stat.title}
          </h3>
          <p className="text-2xl font-bold text-[var(--foreground)]">
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}
