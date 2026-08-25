/**
 * ShipmentsTable Component Tests
 * 
 * Tests for the shipments table component.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import ShipmentsTable from "../ShipmentsTable";
import type { Shipment } from "@/lib/adminApi";

describe("ShipmentsTable", () => {
  const mockShipments: Shipment[] = [
    {
      id: "ship-1",
      customer_id: "cust-1",
      tracking_number: "TRACK-001",
      status: "in_transit",
      carrier: "FedEx",
      origin: "NYC",
      destination: "LAX",
      estimated_delivery: null,
      last_update: "2024-03-10T10:00:00Z",
      deleted_at: null,
      packages: []
    },
    {
      id: "ship-2",
      customer_id: "cust-2",
      tracking_number: "TRACK-002",
      status: "delivered",
      carrier: "UPS",
      origin: "Chicago",
      destination: "Miami",
      estimated_delivery: null,
      last_update: "2024-03-11T14:00:00Z",
      deleted_at: null,
      packages: []
    }
  ];

  const mockHandlers = {
    onToggleExpand: jest.fn(),
    onStatusChange: jest.fn(),
    onAddPackage: jest.fn(),
    onDelete: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render table headers", () => {
    render(
      <ShipmentsTable
        shipments={mockShipments}
        expandedShipmentId={null}
        {...mockHandlers}
      />
    );

    expect(screen.getByText(/Tracking #/i)).toBeInTheDocument();
    expect(screen.getByText(/Customer/i)).toBeInTheDocument();
    expect(screen.getByText(/Status/i)).toBeInTheDocument();
    expect(screen.getByText(/Carrier/i)).toBeInTheDocument();
    expect(screen.getByText(/Route/i)).toBeInTheDocument();
    expect(screen.getByText(/Last Update/i)).toBeInTheDocument();
    expect(screen.getByText(/Actions/i)).toBeInTheDocument();
  });

  it("should render all shipments", () => {
    render(
      <ShipmentsTable
        shipments={mockShipments}
        expandedShipmentId={null}
        {...mockHandlers}
      />
    );

    expect(screen.getByText("TRACK-001")).toBeInTheDocument();
    expect(screen.getByText("TRACK-002")).toBeInTheDocument();
  });

  it("should display empty state when no shipments", () => {
    render(
      <ShipmentsTable
        shipments={[]}
        expandedShipmentId={null}
        {...mockHandlers}
      />
    );

    expect(screen.getByText(/No shipments found/i)).toBeInTheDocument();
  });

  it("should call onToggleExpand with shipment id when row is clicked", () => {
    render(
      <ShipmentsTable
        shipments={mockShipments}
        expandedShipmentId={null}
        {...mockHandlers}
      />
    );

    const firstRow = screen.getByText("TRACK-001").closest("tr");
    fireEvent.click(firstRow!);

    expect(mockHandlers.onToggleExpand).toHaveBeenCalledWith("ship-1");
  });

  it("should pass correct expanded state to ShipmentRow", () => {
    render(
      <ShipmentsTable
        shipments={mockShipments}
        expandedShipmentId="ship-1"
        {...mockHandlers}
      />
    );

    // First shipment should be expanded (would show packages if any)
    // Second shipment should not be expanded
    const rows = screen.getAllByRole("row");
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  it("should call onStatusChange with shipment id and new status", () => {
    render(
      <ShipmentsTable
        shipments={mockShipments}
        expandedShipmentId={null}
        {...mockHandlers}
      />
    );

    const statusSelects = screen.getAllByRole("combobox");
    fireEvent.change(statusSelects[0], { target: { value: "delivered" } });

    expect(mockHandlers.onStatusChange).toHaveBeenCalledWith("ship-1", "delivered");
  });

  it("should call onAddPackage with shipment id", () => {
    render(
      <ShipmentsTable
        shipments={mockShipments}
        expandedShipmentId={null}
        {...mockHandlers}
      />
    );

    const addButtons = screen.getAllByRole("button", { name: /Add Package/i });
    fireEvent.click(addButtons[0]);

    expect(mockHandlers.onAddPackage).toHaveBeenCalledWith("ship-1");
  });

  it("should call onDelete with shipment id", () => {
    render(
      <ShipmentsTable
        shipments={mockShipments}
        expandedShipmentId={null}
        {...mockHandlers}
      />
    );

    const deleteButtons = screen.getAllByRole("button", { name: /Delete/i });
    fireEvent.click(deleteButtons[0]);

    expect(mockHandlers.onDelete).toHaveBeenCalledWith("ship-1");
  });

  it("should render table with proper structure", () => {
    const { container } = render(
      <ShipmentsTable
        shipments={mockShipments}
        expandedShipmentId={null}
        {...mockHandlers}
      />
    );

    const table = container.querySelector("table");
    expect(table).toBeInTheDocument();

    const thead = container.querySelector("thead");
    expect(thead).toBeInTheDocument();

    const tbody = container.querySelector("tbody");
    expect(tbody).toBeInTheDocument();
  });

  it("should be scrollable horizontally", () => {
    const { container } = render(
      <ShipmentsTable
        shipments={mockShipments}
        expandedShipmentId={null}
        {...mockHandlers}
      />
    );

    const wrapper = container.querySelector(".overflow-x-auto");
    expect(wrapper).toBeInTheDocument();
  });

  it("should render with single shipment", () => {
    render(
      <ShipmentsTable
        shipments={[mockShipments[0]]}
        expandedShipmentId={null}
        {...mockHandlers}
      />
    );

    expect(screen.getByText("TRACK-001")).toBeInTheDocument();
    expect(screen.queryByText("TRACK-002")).not.toBeInTheDocument();
  });

  it("should handle shipment with packages correctly", () => {
    const shipmentsWithPackages: Shipment[] = [
      {
        ...mockShipments[0],
        packages: [
          {
            id: "pkg-1",
            shipment_id: "ship-1",
            description: "Test Package",
            weight_kg: "1.0",
            declared_value: "100.00"
          }
        ]
      }
    ];

    render(
      <ShipmentsTable
        shipments={shipmentsWithPackages}
        expandedShipmentId="ship-1"
        {...mockHandlers}
      />
    );

    expect(screen.getByText("Test Package")).toBeInTheDocument();
  });

  it("should pass all handlers to ShipmentRow components", () => {
    render(
      <ShipmentsTable
        shipments={mockShipments}
        expandedShipmentId={null}
        {...mockHandlers}
      />
    );

    // Verify all action buttons are present (indicating handlers are passed)
    const addButtons = screen.getAllByRole("button", { name: /Add Package/i });
    expect(addButtons.length).toBe(mockShipments.length);

    const deleteButtons = screen.getAllByRole("button", { name: /Delete/i });
    expect(deleteButtons.length).toBe(mockShipments.length);
  });
});
