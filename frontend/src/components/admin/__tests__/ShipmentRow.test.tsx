/**
 * ShipmentRow Component Tests
 *
 * Tests for the individual shipment table row component.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import ShipmentRow from "../ShipmentRow";
import type { Shipment } from "@/lib/adminApi";

describe("ShipmentRow", () => {
  const mockShipment: Shipment = {
    id: "ship-123",
    customer_id: "cust-456",
    tracking_number: "1Z999AA10123456784",
    status: "in_transit",
    carrier: "FedEx",
    origin: "New York, NY",
    destination: "Los Angeles, CA",
    estimated_delivery: "2024-03-15T12:00:00Z",
    last_update: "2024-03-10T10:30:00Z",
    deleted_at: null,
    packages: [
      {
        id: "pkg-1",
        shipment_id: "ship-123",
        description: "Electronics",
        weight_kg: "2.5",
        declared_value: "500.00",
      },
    ],
  };

  const mockHandlers = {
    onToggleExpand: jest.fn(),
    onStatusChange: jest.fn(),
    onAddPackage: jest.fn(),
    onDelete: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render tracking number", () => {
    render(
      <table>
        <tbody>
          <ShipmentRow
            shipment={mockShipment}
            isExpanded={false}
            {...mockHandlers}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByText("1Z999AA10123456784")).toBeInTheDocument();
  });

  it("should render truncated customer ID", () => {
    render(
      <table>
        <tbody>
          <ShipmentRow
            shipment={mockShipment}
            isExpanded={false}
            {...mockHandlers}
          />
        </tbody>
      </table>,
    );

    // Should show first 8 chars of customer_id
    expect(screen.getByText(/cust-456/i)).toBeInTheDocument();
  });

  it("should render carrier information", () => {
    render(
      <table>
        <tbody>
          <ShipmentRow
            shipment={mockShipment}
            isExpanded={false}
            {...mockHandlers}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByText("FedEx")).toBeInTheDocument();
  });

  it("should render origin and destination", () => {
    render(
      <table>
        <tbody>
          <ShipmentRow
            shipment={mockShipment}
            isExpanded={false}
            {...mockHandlers}
          />
        </tbody>
      </table>,
    );

    expect(
      screen.getByText(/New York, NY → Los Angeles, CA/i),
    ).toBeInTheDocument();
  });

  it("should render status dropdown", () => {
    render(
      <table>
        <tbody>
          <ShipmentRow
            shipment={mockShipment}
            isExpanded={false}
            {...mockHandlers}
          />
        </tbody>
      </table>,
    );

    const statusSelect = screen.getByRole("combobox");
    expect(statusSelect).toBeInTheDocument();
    // Check if in_transit option exists
    expect(screen.getByText("In Transit")).toBeInTheDocument();
  });

  it("should render action buttons", () => {
    render(
      <table>
        <tbody>
          <ShipmentRow
            shipment={mockShipment}
            isExpanded={false}
            {...mockHandlers}
          />
        </tbody>
      </table>,
    );

    expect(
      screen.getByRole("button", { name: /Add Package/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Delete/i })).toBeInTheDocument();
  });

  it("should call onToggleExpand when row is clicked", () => {
    render(
      <table>
        <tbody>
          <ShipmentRow
            shipment={mockShipment}
            isExpanded={false}
            {...mockHandlers}
          />
        </tbody>
      </table>,
    );

    const row = screen.getByText("1Z999AA10123456784").closest("tr");
    fireEvent.click(row!);

    expect(mockHandlers.onToggleExpand).toHaveBeenCalledTimes(1);
  });

  it("should not toggle expand when clicking on status select", () => {
    render(
      <table>
        <tbody>
          <ShipmentRow
            shipment={mockShipment}
            isExpanded={false}
            {...mockHandlers}
          />
        </tbody>
      </table>,
    );

    const statusSelect = screen.getByRole("combobox");
    fireEvent.click(statusSelect);

    expect(mockHandlers.onToggleExpand).not.toHaveBeenCalled();
  });

  it("should call onStatusChange when status is changed", () => {
    render(
      <table>
        <tbody>
          <ShipmentRow
            shipment={mockShipment}
            isExpanded={false}
            {...mockHandlers}
          />
        </tbody>
      </table>,
    );

    const statusSelect = screen.getByRole("combobox");
    fireEvent.change(statusSelect, { target: { value: "delivered" } });

    expect(mockHandlers.onStatusChange).toHaveBeenCalledWith("delivered");
  });

  it("should call onAddPackage when Add Package button is clicked", () => {
    render(
      <table>
        <tbody>
          <ShipmentRow
            shipment={mockShipment}
            isExpanded={false}
            {...mockHandlers}
          />
        </tbody>
      </table>,
    );

    const addButton = screen.getByRole("button", { name: /Add Package/i });
    fireEvent.click(addButton);

    expect(mockHandlers.onAddPackage).toHaveBeenCalledTimes(1);
  });

  it("should call onDelete when Delete button is clicked", () => {
    render(
      <table>
        <tbody>
          <ShipmentRow
            shipment={mockShipment}
            isExpanded={false}
            {...mockHandlers}
          />
        </tbody>
      </table>,
    );

    const deleteButton = screen.getByRole("button", { name: /Delete/i });
    fireEvent.click(deleteButton);

    expect(mockHandlers.onDelete).toHaveBeenCalledTimes(1);
  });

  it("should not toggle expand when clicking action buttons", () => {
    render(
      <table>
        <tbody>
          <ShipmentRow
            shipment={mockShipment}
            isExpanded={false}
            {...mockHandlers}
          />
        </tbody>
      </table>,
    );

    const deleteButton = screen.getByRole("button", { name: /Delete/i });
    fireEvent.click(deleteButton);

    expect(mockHandlers.onToggleExpand).not.toHaveBeenCalled();
  });

  it("should display packages when expanded", () => {
    render(
      <table>
        <tbody>
          <ShipmentRow
            shipment={mockShipment}
            isExpanded={true}
            {...mockHandlers}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByText("Electronics")).toBeInTheDocument();
  });

  it("should not display packages when collapsed", () => {
    render(
      <table>
        <tbody>
          <ShipmentRow
            shipment={mockShipment}
            isExpanded={false}
            {...mockHandlers}
          />
        </tbody>
      </table>,
    );

    expect(screen.queryByText("Electronics")).not.toBeInTheDocument();
  });

  it("should not display expanded row if no packages", () => {
    const shipmentNoPackages = { ...mockShipment, packages: [] };

    render(
      <table>
        <tbody>
          <ShipmentRow
            shipment={shipmentNoPackages}
            isExpanded={true}
            {...mockHandlers}
          />
        </tbody>
      </table>,
    );

    // Should only have one row (the main row, no expanded row)
    const rows = screen.getAllByRole("row");
    expect(rows.length).toBe(1);
  });

  it("should render all status options in dropdown", () => {
    render(
      <table>
        <tbody>
          <ShipmentRow
            shipment={mockShipment}
            isExpanded={false}
            {...mockHandlers}
          />
        </tbody>
      </table>,
    );

    const statusSelect = screen.getByRole("combobox");
    const options = Array.from(statusSelect.querySelectorAll("option"));

    expect(options.some((opt) => opt.value === "label_created")).toBe(true);
    expect(options.some((opt) => opt.value === "in_transit")).toBe(true);
    expect(options.some((opt) => opt.value === "out_for_delivery")).toBe(true);
    expect(options.some((opt) => opt.value === "delivered")).toBe(true);
    expect(options.some((opt) => opt.value === "exception")).toBe(true);
  });
});
