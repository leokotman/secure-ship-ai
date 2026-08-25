/**
 * Create Shipment Form Component
 * 
 * Modal form for creating new shipments.
 */

import { useState } from "react";
import { adminApi } from "../../../lib/adminApi";

interface CreateShipmentFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function CreateShipmentForm({ onSuccess, onCancel }: CreateShipmentFormProps) {
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
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Create New Shipment</h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Customer ID <span className="text-red-600">*</span>
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
            Tracking Number <span className="text-red-600">*</span>
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
            Carrier <span className="text-red-600">*</span>
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
            Origin <span className="text-red-600">*</span>
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
            Destination <span className="text-red-600">*</span>
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

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
        >
          Cancel
        </button>
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
