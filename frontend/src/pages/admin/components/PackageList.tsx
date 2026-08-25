/**
 * Package List Component
 * 
 * Displays packages within an expanded shipment row.
 */

import { Package } from "../../../lib/adminApi";

interface PackageListProps {
  packages: Package[];
}

export default function PackageList({ packages }: PackageListProps) {
  if (!packages || packages.length === 0) {
    return null;
  }

  return (
    <div className="text-sm">
      <strong className="text-gray-700">
        Packages ({packages.length}):
      </strong>
      <ul className="mt-2 space-y-2">
        {packages.map((pkg) => (
          <li key={pkg.id} className="text-gray-600 flex items-center gap-4">
            <span className="font-medium text-gray-900">{pkg.description}</span>
            <span className="text-gray-500">•</span>
            <span>{pkg.weight_kg}kg</span>
            <span className="text-gray-500">•</span>
            <span className="text-green-600 font-medium">${pkg.declared_value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
