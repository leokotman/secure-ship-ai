/**
 * Package Form Component
 *
 * Modal form for creating packages within a shipment.
 */

import { useState } from "react";
import { adminApi } from "@/lib/adminApi";

interface PackageFormProps {
  shipmentId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function PackageForm({
  shipmentId,
  onSuccess,
  onCancel,
}: PackageFormProps) {
  const [packageData, setPackageData] = useState({
    description: "",
    weight_kg: "",
    declared_value: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await adminApi.createPackage({
        shipment_id: shipmentId,
        description: packageData.description,
        weight_kg: parseFloat(packageData.weight_kg),
        declared_value: parseFloat(packageData.declared_value),
      });

      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create package");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <h3 className="text-lg font-semibold mb-4">Add Package</h3>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={packageData.description}
              onChange={(e) =>
                setPackageData({ ...packageData, description: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Electronics, Documents, etc."
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Weight (kg) <span className="text-red-600">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={packageData.weight_kg}
              onChange={(e) =>
                setPackageData({ ...packageData, weight_kg: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="2.5"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Declared Value ($) <span className="text-red-600">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={packageData.declared_value}
              onChange={(e) =>
                setPackageData({
                  ...packageData,
                  declared_value: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="100.00"
              required
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Creating..." : "Create Package"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
