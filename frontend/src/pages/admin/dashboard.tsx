/**
 * Admin Dashboard
 *
 * Main admin interface for managing shipments and packages.
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { adminApi, Shipment, DashboardStats as Stats } from "../../lib/adminApi";
import {
  DashboardHeader,
  DashboardStats,
  ShipmentsTable,
  CreateShipmentForm,
  PackageForm,
} from "./components";
import LoadingSpinner from "../../components/LoadingSpinner";
import ErrorAlert from "../../components/ErrorAlert";

export default function AdminDashboard() {
  const router = useRouter();

  // State management
  const [stats, setStats] = useState<Stats | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedShipmentId, setExpandedShipmentId] = useState<string | null>(null);
  const [showPackageForm, setShowPackageForm] = useState(false);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);

  // Load dashboard data
  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [dashboardStats, shipmentList] = await Promise.all([
        adminApi.getDashboardStats(),
        adminApi.listShipments({ page: 1, page_size: 50 }),
      ]);

      setStats(dashboardStats);
      setShipments(shipmentList.shipments);
    } catch (err: any) {
      console.error("Failed to load dashboard:", err);
      if (err.response?.status === 401) {
        localStorage.removeItem("admin_access_token");
        router.push("/admin");
      } else {
        setError(err.response?.data?.detail || "Failed to load dashboard data");
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Authentication check and initial load
  useEffect(() => {
    const token = localStorage.getItem("admin_access_token");
    if (!token) {
      router.push("/admin");
      return;
    }

    adminApi.setAccessToken(token);
    loadDashboard();
  }, [router, loadDashboard]);

  // Event handlers
  const handleLogout = () => {
    localStorage.removeItem("admin_access_token");
    router.push("/admin");
  };

  const handleStatusFilterChange = async (status: string) => {
    setStatusFilter(status);
    try {
      const result = await adminApi.listShipments({
        status: status || undefined,
        page: 1,
        page_size: 50,
      });
      setShipments(result.shipments);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to filter shipments");
    }
  };

  const handleDeleteShipment = async (id: string) => {
    if (!confirm("Are you sure you want to delete this shipment?")) {
      return;
    }

    try {
      await adminApi.deleteShipment(id);
      await loadDashboard();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to delete shipment");
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await adminApi.updateShipment(id, { status: newStatus as any });
      await loadDashboard();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to update shipment");
    }
  };

  const handleToggleExpand = (shipmentId: string) => {
    setExpandedShipmentId(
      expandedShipmentId === shipmentId ? null : shipmentId
    );
  };

  const handleAddPackage = (shipmentId: string) => {
    setSelectedShipmentId(shipmentId);
    setShowPackageForm(true);
  };

  const handlePackageSuccess = async () => {
    setShowPackageForm(false);
    setSelectedShipmentId(null);
    await loadDashboard();
  };

  const handlePackageCancel = () => {
    setShowPackageForm(false);
    setSelectedShipmentId(null);
  };

  const handleShipmentSuccess = async () => {
    setShowCreateForm(false);
    await loadDashboard();
  };

  const handleShipmentCancel = () => {
    setShowCreateForm(false);
  };

  // Render loading state
  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <DashboardHeader onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ErrorAlert error={error} onDismiss={() => setError("")} />

        {stats && <DashboardStats stats={stats} />}

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Shipments</h2>
            <div className="flex items-center gap-4">
              <select
                value={statusFilter}
                onChange={(e) => handleStatusFilterChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                <option value="label_created">Label Created</option>
                <option value="in_transit">In Transit</option>
                <option value="out_for_delivery">Out for Delivery</option>
                <option value="delivered">Delivered</option>
                <option value="exception">Exception</option>
              </select>
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {showCreateForm ? "Cancel" : "Create Shipment"}
              </button>
            </div>
          </div>

          {showCreateForm && (
            <CreateShipmentForm
              onSuccess={handleShipmentSuccess}
              onCancel={handleShipmentCancel}
            />
          )}

          <ShipmentsTable
            shipments={shipments}
            expandedShipmentId={expandedShipmentId}
            onToggleExpand={handleToggleExpand}
            onStatusChange={handleUpdateStatus}
            onAddPackage={handleAddPackage}
            onDelete={handleDeleteShipment}
          />
        </div>

        {showPackageForm && selectedShipmentId && (
          <PackageForm
            shipmentId={selectedShipmentId}
            onSuccess={handlePackageSuccess}
            onCancel={handlePackageCancel}
          />
        )}
      </main>
    </div>
  );
}
