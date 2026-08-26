/**
 * Dashboard Header Component
 *
 * Top navigation bar with title and logout.
 */

interface DashboardHeaderProps {
  onLogout: () => void;
}

export default function DashboardHeader({ onLogout }: DashboardHeaderProps) {
  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">SecureShip Admin</h1>
        <button
          onClick={onLogout}
          className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
