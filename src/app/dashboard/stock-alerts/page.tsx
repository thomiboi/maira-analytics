import StockAlerts from "@/components/products/StockAlerts";

export default function StockAlertsPage() {
  return (
    <div className="flex flex-col h-screen bg-[var(--background)]">
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[var(--foreground)]">
              Control de Stock
            </h1>
            <p className="text-[var(--text-muted)]">
              Configura alertas de stock mínimo por sucursal
            </p>
          </div>
          <StockAlerts />
        </div>
      </main>
    </div>
  );
}
