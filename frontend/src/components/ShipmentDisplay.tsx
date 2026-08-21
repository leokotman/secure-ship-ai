import type { ShipmentPayload } from '@/lib/api';

const STATUS_STYLES: Record<string, string> = {
    label_created: 'bg-gray-100 text-gray-700',
    in_transit: 'bg-blue-100 text-blue-700',
    out_for_delivery: 'bg-yellow-100 text-yellow-800',
    delivered: 'bg-green-100 text-green-700',
    exception: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
    label_created: 'Label Created',
    in_transit: 'In Transit',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    exception: 'Exception',
};

interface ShipmentDisplayProps {
    shipment: ShipmentPayload;
}

export function ShipmentDisplay({ shipment }: ShipmentDisplayProps) {
    const statusStyle = STATUS_STYLES[shipment.status] ?? 'bg-gray-100 text-gray-700';
    const statusLabel = STATUS_LABELS[shipment.status] ?? shipment.status;

    const estimatedDelivery = shipment.estimated_delivery
        ? new Date(shipment.estimated_delivery).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        })
        : null;

    return (
        <div className="mt-2 rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-sm">
            <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-gray-500">{shipment.tracking_number}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle}`}>
                    {statusLabel}
                </span>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                <div>
                    <span className="font-medium text-gray-700">Carrier:</span> {shipment.carrier}
                </div>
                {estimatedDelivery && (
                    <div>
                        <span className="font-medium text-gray-700">Est. Delivery:</span>{' '}
                        {estimatedDelivery}
                    </div>
                )}
                <div>
                    <span className="font-medium text-gray-700">From:</span> {shipment.origin}
                </div>
                <div>
                    <span className="font-medium text-gray-700">To:</span> {shipment.destination}
                </div>
            </div>

            {shipment.packages.length > 0 && (
                <div className="mt-2 border-t border-gray-100 pt-2">
                    <p className="text-xs font-medium text-gray-700">
                        {shipment.packages.length === 1 ? '1 package' : `${shipment.packages.length} packages`}
                    </p>
                    <ul className="mt-1 space-y-0.5">
                        {shipment.packages.map((pkg, i) => (
                            <li key={i} className="text-xs text-gray-500">
                                {pkg.description} — {pkg.weight_kg} kg
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
