/**
 * Shipment Row Component
 *
 * Individual shipment table row with expand/collapse for packages.
 */

import { Shipment } from "@/lib/adminApi";
import PackageList from "./PackageList";

interface ShipmentRowProps {
  shipment: Shipment;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onStatusChange: (newStatus: string) => void;
  onAddPackage: () => void;
  onDelete: () => void;
}

export default function ShipmentRow({
  shipment,
  isExpanded,
  onToggleExpand,
  onStatusChange,
  onAddPackage,
  onDelete,
}: ShipmentRowProps) {
  const handleRowClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Don't toggle if clicking on interactive elements
    if (target.tagName !== "SELECT" && target.tagName !== "BUTTON") {
      onToggleExpand();
    }
  };

  return (
    <>
      <tr className="hover:bg-gray-50 cursor-pointer" onClick={handleRowClick}>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
          {shipment.tracking_number}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {shipment.customer_id.substring(0, 8)}...
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <select
            value={shipment.status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1"
          >
            <option value="label_created">Label Created</option>
            <option value="in_transit">In Transit</option>
            <option value="out_for_delivery">Out for Delivery</option>
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
            onClick={(e) => {
              e.stopPropagation();
              onAddPackage();
            }}
            className="text-blue-600 hover:text-blue-900 mr-4"
          >
            Add Package
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-red-600 hover:text-red-900"
          >
            Delete
          </button>
        </td>
      </tr>

      {isExpanded && shipment.packages && shipment.packages.length > 0 && (
        <tr>
          <td colSpan={7} className="px-6 py-4 bg-gray-50">
            <PackageList packages={shipment.packages} />
          </td>
        </tr>
      )}
    </>
  );
}
