/**
 * Admin Dashboard Integration Tests
 *
 * Tests for the main admin dashboard page (Week 4 feature).
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useRouter } from "next/router";
import AdminDashboard from "../../admin/dashboard";
import { adminApi } from "@/lib/adminApi";

// Mock Next.js router
jest.mock("next/router", () => ({
  useRouter: jest.fn(),
}));

// Mock adminApi
jest.mock("@/lib/adminApi", () => ({
  adminApi: {
    setAccessToken: jest.fn(),
    getDashboardStats: jest.fn(),
    listShipments: jest.fn(),
    deleteShipment: jest.fn(),
    updateShipment: jest.fn(),
  },
}));

// Mock child components to simplify testing
jest.mock("@/components/LoadingSpinner", () => ({
  __esModule: true,
  default: () => <div>Loading...</div>,
}));

jest.mock("@/components/ErrorAlert", () => ({
  __esModule: true,
  default: ({ error, onDismiss }: { error: string; onDismiss: () => void }) =>
    error ? (
      <div role="alert">
        {error}
        <button onClick={onDismiss}>Dismiss</button>
      </div>
    ) : null,
}));

describe("AdminDashboard", () => {
  const mockPush = jest.fn();
  const mockRouter = {
    push: mockPush,
    pathname: "/admin/dashboard",
    query: {},
    asPath: "/admin/dashboard",
  };

  const mockStats = {
    total_shipments: 100,
    by_status: {
      in_transit: 30,
      out_for_delivery: 20,
      delivered: 45,
      label_created: 5,
    },
    recent_shipments: [],
  };

  const mockShipments = [
    {
      id: "ship-1",
      customer_id: "cust-1",
      tracking_number: "TRACK-001",
      status: "in_transit" as const,
      carrier: "FedEx",
      origin: "NYC",
      destination: "LAX",
      estimated_delivery: null,
      last_update: "2024-03-10T10:00:00Z",
      deleted_at: null,
      packages: [],
    },
    {
      id: "ship-2",
      customer_id: "cust-2",
      tracking_number: "TRACK-002",
      status: "delivered" as const,
      carrier: "UPS",
      origin: "Chicago",
      destination: "Miami",
      estimated_delivery: null,
      last_update: "2024-03-11T14:00:00Z",
      deleted_at: null,
      packages: [],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    localStorage.setItem("admin_access_token", "test-token");

    (adminApi.getDashboardStats as jest.Mock).mockResolvedValue(mockStats);
    (adminApi.listShipments as jest.Mock).mockResolvedValue({
      shipments: mockShipments,
      total: 2,
      page: 1,
      page_size: 50,
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("should redirect to login if no access token", () => {
    localStorage.removeItem("admin_access_token");

    render(<AdminDashboard />);

    expect(mockPush).toHaveBeenCalledWith("/admin");
  });

  it("should load dashboard data on mount", async () => {
    render(<AdminDashboard />);

    await waitFor(() => {
      expect(adminApi.setAccessToken).toHaveBeenCalledWith("test-token");
      expect(adminApi.getDashboardStats).toHaveBeenCalled();
      expect(adminApi.listShipments).toHaveBeenCalled();
    });
  });

  it("should display loading spinner while loading", () => {
    (adminApi.getDashboardStats as jest.Mock).mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );

    render(<AdminDashboard />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("should render dashboard stats after loading", async () => {
    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });

    // Stats should be rendered
    expect(screen.getByText("100")).toBeInTheDocument(); // total shipments
  });

  it("should render shipments table after loading", async () => {
    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText("TRACK-001")).toBeInTheDocument();
      expect(screen.getByText("TRACK-002")).toBeInTheDocument();
    });
  });

  it("should render dashboard header with logout button", async () => {
    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/SecureShip Admin/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Logout/i }),
      ).toBeInTheDocument();
    });
  });

  it("should logout and redirect when logout button is clicked", async () => {
    render(<AdminDashboard />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Logout/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Logout/i }));

    expect(localStorage.getItem("admin_access_token")).toBeNull();
    expect(mockPush).toHaveBeenCalledWith("/admin");
  });

  it("should toggle create shipment form", async () => {
    render(<AdminDashboard />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Create Shipment/i }),
      ).toBeInTheDocument();
    });

    const createButton = screen.getByRole("button", {
      name: /Create Shipment/i,
    });
    fireEvent.click(createButton);

    expect(await screen.findByText(/Create New Shipment/i)).toBeInTheDocument();

    // Click cancel button to hide (get the close X button)
    const closeButton = screen.getByText("✕");
    fireEvent.click(closeButton);
  });

  it("should filter shipments by status", async () => {
    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText("TRACK-001")).toBeInTheDocument();
    });

    // Get the filter dropdown (the one with "All Status" option)
    const statusFilter =
      screen.getByDisplayValue("All Status") ||
      screen.getAllByRole("combobox")[0];
    fireEvent.change(statusFilter, { target: { value: "delivered" } });

    await waitFor(() => {
      expect(adminApi.listShipments).toHaveBeenCalledWith({
        status: "delivered",
        page: 1,
        page_size: 50,
      });
    });
  });

  it("should handle delete shipment with confirmation", async () => {
    // Mock window.confirm
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
    (adminApi.deleteShipment as jest.Mock).mockResolvedValue(undefined);

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText("TRACK-001")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole("button", { name: /Delete/i });
    fireEvent.click(deleteButtons[0]);

    expect(confirmSpy).toHaveBeenCalled();

    await waitFor(() => {
      expect(adminApi.deleteShipment).toHaveBeenCalledWith("ship-1");
    });

    confirmSpy.mockRestore();
  });

  it("should not delete if user cancels confirmation", async () => {
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(false);

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText("TRACK-001")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole("button", { name: /Delete/i });
    fireEvent.click(deleteButtons[0]);

    expect(adminApi.deleteShipment).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("should update shipment status", async () => {
    (adminApi.updateShipment as jest.Mock).mockResolvedValue({});

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText("TRACK-001")).toBeInTheDocument();
    });

    const statusSelects = screen.getAllByRole("combobox");
    // First combobox is the filter, shipment status selects come after
    fireEvent.change(statusSelects[1], { target: { value: "delivered" } });

    await waitFor(() => {
      expect(adminApi.updateShipment).toHaveBeenCalledWith("ship-1", {
        status: "delivered",
      });
    });
  });

  it("should display error when API call fails", async () => {
    (adminApi.getDashboardStats as jest.Mock).mockRejectedValue({
      response: {
        data: {
          detail: "Failed to load data",
        },
      },
    });

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/Failed to load data/i)).toBeInTheDocument();
    });
  });

  it("should redirect on 401 error", async () => {
    (adminApi.getDashboardStats as jest.Mock).mockRejectedValue({
      response: {
        status: 401,
        data: {
          detail: "Unauthorized",
        },
      },
    });

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(localStorage.getItem("admin_access_token")).toBeNull();
      expect(mockPush).toHaveBeenCalledWith("/admin");
    });
  });

  it("should allow dismissing error messages", async () => {
    (adminApi.getDashboardStats as jest.Mock).mockRejectedValue({
      response: {
        data: {
          detail: "Test error",
        },
      },
    });

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Dismiss/i }));

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  it("should handle add package action", async () => {
    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText("TRACK-001")).toBeInTheDocument();
    });

    const addPackageButtons = screen.getAllByRole("button", {
      name: /Add Package/i,
    });
    fireEvent.click(addPackageButtons[0]);

    // Package form modal should appear with heading
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Add Package/i }),
      ).toBeInTheDocument();
    });
  });

  it("should expand/collapse shipment rows", async () => {
    const shipmentsWithPackages = [
      {
        ...mockShipments[0],
        packages: [
          {
            id: "pkg-1",
            shipment_id: "ship-1",
            description: "Test Package",
            weight_kg: "1.0",
            declared_value: "100.00",
          },
        ],
      },
    ];

    (adminApi.listShipments as jest.Mock).mockResolvedValue({
      shipments: shipmentsWithPackages,
      total: 1,
      page: 1,
      page_size: 50,
    });

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText("TRACK-001")).toBeInTheDocument();
    });

    // Initially package details should not be visible
    expect(screen.queryByText("Test Package")).not.toBeInTheDocument();

    // Click row to expand
    const row = screen.getByText("TRACK-001").closest("tr");
    fireEvent.click(row!);

    // Package should now be visible
    await waitFor(() => {
      expect(screen.getByText("Test Package")).toBeInTheDocument();
    });
  });
});
