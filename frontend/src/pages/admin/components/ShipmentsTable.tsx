/**
 * Shipments Table Component
 * 
 * Main table displaying all shipments with filtering.
 */

import { Shipment } from "../../../lib/adminApi";
import ShipmentRow from "./ShipmentRow";

interface ShipmentsTableProps {
  shipments: Shipment[];
  expandedShipmentId: string | null;
  onToggleExpand: (shipmentId: string) => void;
  onStatusChange: (shipmentId: string, newStatus: string) => void;
  onAddPackage: (shipmentId: string) => void;
  onDelete: (shipmentId: string) => void;
}

export default function ShipmentsTable({
  shipments,
  expandedShipmentId,
  onToggleExpand,
  onStatusChange,
  onAddPackage,
  onDelete,
}: ShipmentsTableProps) {
  return (
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
              <ShipmentRow
                key={shipment.id}
                shipment={shipment}
                isExpanded={expandedShipmentId === shipment.id}
                onToggleExpand={() => onToggleExpand(shipment.id)}
                onStatusChange={(newStatus) => onStatusChange(shipment.id, newStatus)}
                onAddPackage={() => onAddPackage(shipment.id)}
                onDelete={() => onDelete(shipment.id)}
              />
            ))}
          </tbody>
        </table>

        {shipments.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No shipments found
          </div>
        )}
      </div>
  );
}
