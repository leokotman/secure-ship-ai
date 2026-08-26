/**
 * Dashboard Statistics Cards
 *
 * Displays overview statistics for shipments by status.
 */

import { DashboardStats as Stats } from "@/lib/adminApi";

interface DashboardStatsProps {
  stats: Stats;
}

export default function DashboardStats({ stats }: DashboardStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <StatCard
        label="Total Shipments"
        value={stats.total_shipments}
        className="text-gray-900"
      />
      <StatCard
        label="In Transit"
        value={stats.by_status.in_transit || 0}
        className="text-blue-600"
      />
      <StatCard
        label="Out for Delivery"
        value={stats.by_status.out_for_delivery || 0}
        className="text-yellow-600"
      />
      <StatCard
        label="Delivered"
        value={stats.by_status.delivered || 0}
        className="text-green-600"
      />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  className?: string;
}

function StatCard({
  label,
  value,
  className = "text-gray-900",
}: StatCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="text-sm font-medium text-gray-500">{label}</div>
      <div className={`mt-2 text-3xl font-bold ${className}`}>{value}</div>
    </div>
  );
}
