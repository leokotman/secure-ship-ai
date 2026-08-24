/**
 * Admin Dashboard
 *
 * Main admin interface for managing shipments and packages.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { adminApi, Shipment, DashboardStats } from "../../lib/adminApi";

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem("admin_access_token");
    if (!token) {
      router.push("/admin");
      return;
    }

    // Set token in API client
    adminApi.setAccessToken(token);

    // Load initial data
    loadDashboard();
  }, [router]);

  const loadDashboard = async () => {
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
        // Token expired or invalid
        localStorage.removeItem("admin_access_token");
        router.push("/admin");
      } else {
        setError(err.response?.data?.detail || "Failed to load dashboard data");
      }
    } finally {
      setLoading(false);
    }
  };

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
      // Reload shipments
      await loadDashboard();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to delete shipment");
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await adminApi.updateShipment(id, { status: newStatus as any });
      // Reload shipments
      await loadDashboard();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to update shipment");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">SecureShip Admin</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
            <button onClick={() => setError("")} className="ml-4 underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500">
                Total Shipments
              </div>
              <div className="mt-2 text-3xl font-bold text-gray-900">
                {stats.total_shipments}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500">
                In Transit
              </div>
              <div className="mt-2 text-3xl font-bold text-blue-600">
                {stats.by_status.in_transit || 0}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500">
                Out for Delivery
              </div>
              <div className="mt-2 text-3xl font-bold text-yellow-600">
                {stats.by_status.out_for_delivery || 0}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500">Delivered</div>
              <div className="mt-2 text-3xl font-bold text-green-600">
                {stats.by_status.delivered || 0}
              </div>
            </div>
          </div>
        )}

        {/* Shipments Table */}
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
              onSuccess={() => {
                setShowCreateForm(false);
                loadDashboard();
              }}
            />
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tracking #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Carrier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Route
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Update
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {shipments.map((shipment) => (
                  <tr key={shipment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {shipment.tracking_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {shipment.customer_id.substring(0, 8)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={shipment.status}
                        onChange={(e) =>
                          handleUpdateStatus(shipment.id, e.target.value)
                        }
                        className="text-sm border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="label_created">Label Created</option>
                        <option value="in_transit">In Transit</option>
                        <option value="out_for_delivery">
                          Out for Delivery
                        </option>
                        <option value="delivered">Delivered</option>
                        <option value="exception">Exception</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {shipment.carrier}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div className="max-w-xs truncate">
                        {shipment.origin} → {shipment.destination}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(shipment.last_update).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleDeleteShipment(shipment.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {shipments.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No shipments found
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// Create Shipment Form Component
function CreateShipmentForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    customer_id: "",
    tracking_number: "",
    status: "label_created",
    carrier: "",
    origin: "",
    destination: "",
    estimated_delivery: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await adminApi.createShipment({
        ...formData,
        estimated_delivery: formData.estimated_delivery || undefined,
      } as any);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create shipment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-6 border-b border-gray-200 bg-gray-50"
    >
      <h3 className="text-lg font-semibold mb-4">Create New Shipment</h3>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Customer ID
          </label>
          <input
            type="text"
            required
            value={formData.customer_id}
            onChange={(e) =>
              setFormData({ ...formData, customer_id: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="615bbe4a-2716-4322-8006-b5e2d759689f"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tracking Number
          </label>
          <input
            type="text"
            required
            value={formData.tracking_number}
            onChange={(e) =>
              setFormData({ ...formData, tracking_number: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="SHIP-001"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Carrier
          </label>
          <input
            type="text"
            required
            value={formData.carrier}
            onChange={(e) =>
              setFormData({ ...formData, carrier: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="FedEx"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={formData.status}
            onChange={(e) =>
              setFormData({ ...formData, status: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="label_created">Label Created</option>
            <option value="in_transit">In Transit</option>
            <option value="out_for_delivery">Out for Delivery</option>
            <option value="delivered">Delivered</option>
            <option value="exception">Exception</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Origin
          </label>
          <input
            type="text"
            required
            value={formData.origin}
            onChange={(e) =>
              setFormData({ ...formData, origin: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="New York, NY"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Destination
          </label>
          <input
            type="text"
            required
            value={formData.destination}
            onChange={(e) =>
              setFormData({ ...formData, destination: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Los Angeles, CA"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Estimated Delivery (Optional)
          </label>
          <input
            type="datetime-local"
            value={formData.estimated_delivery}
            onChange={(e) =>
              setFormData({ ...formData, estimated_delivery: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Creating..." : "Create Shipment"}
        </button>
      </div>
    </form>
  );
}
