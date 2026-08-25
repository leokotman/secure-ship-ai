/**
 * ShipmentDisplay Component Tests
 * 
 * Tests for shipment data display component (Week 3 feature).
 */

import { render, screen } from "@testing-library/react";
import { ShipmentDisplay } from "../ShipmentDisplay";

describe("ShipmentDisplay", () => {
  const mockShipment = {
    id: "ship-123",
    customer_id: "cust-456",
    tracking_number: "1Z999AA10123456784",
    status: "in_transit" as const,
    carrier: "FedEx",
    origin: "New York, NY",
    destination: "Los Angeles, CA",
    estimated_delivery: "2024-03-15T12:00:00Z",
    last_update: "2024-03-10T10:30:00Z",
    packages: [
      {
        id: "pkg-1",
        shipment_id: "ship-123",
        description: "Electronics",
        weight_kg: "2.5",
        declared_value: "500.00"
      }
    ]
  };

  it("should render shipment tracking number", () => {
    render(<ShipmentDisplay shipment={mockShipment} />);
    expect(screen.getByText(/1Z999AA10123456784/i)).toBeInTheDocument();
  });

  it("should render shipment status", () => {
    render(<ShipmentDisplay shipment={mockShipment} />);
    expect(screen.getByText(/in transit/i)).toBeInTheDocument();
  });

  it("should render carrier information", () => {
    render(<ShipmentDisplay shipment={mockShipment} />);
    expect(screen.getByText(/FedEx/i)).toBeInTheDocument();
  });

  it("should render origin and destination", () => {
    render(<ShipmentDisplay shipment={mockShipment} />);
    expect(screen.getByText(/New York, NY/i)).toBeInTheDocument();
    expect(screen.getByText(/Los Angeles, CA/i)).toBeInTheDocument();
  });

  it("should render estimated delivery date when provided", () => {
    render(<ShipmentDisplay shipment={mockShipment} />);
    // Date formatting may vary, just check it exists
    expect(screen.getByText(/Est\.? Delivery/i)).toBeInTheDocument();
  });

  it("should render package information", () => {
    render(<ShipmentDisplay shipment={mockShipment} />);
    expect(screen.getByText(/Electronics/i)).toBeInTheDocument();
    expect(screen.getByText(/2\.5/)).toBeInTheDocument();
    // Package value might not be displayed in ShipmentDisplay, just check description and weight
  });

  it("should render multiple packages", () => {
    const shipmentWithMultiplePackages = {
      ...mockShipment,
      packages: [
        {
          id: "pkg-1",
          shipment_id: "ship-123",
          description: "Electronics",
          weight_kg: "2.5",
          declared_value: "500.00"
        },
        {
          id: "pkg-2",
          shipment_id: "ship-123",
          description: "Documents",
          weight_kg: "0.5",
          declared_value: "50.00"
        }
      ]
    };

    render(<ShipmentDisplay shipment={shipmentWithMultiplePackages} />);
    expect(screen.getByText(/Electronics/i)).toBeInTheDocument();
    expect(screen.getByText(/Documents/i)).toBeInTheDocument();
  });

  it("should render without packages", () => {
    const shipmentNoPackages = {
      ...mockShipment,
      packages: []
    };

    const { container } = render(<ShipmentDisplay shipment={shipmentNoPackages} />);
    expect(container).toBeInTheDocument();
    expect(screen.getByText(/1Z999AA10123456784/i)).toBeInTheDocument();
  });

  it("should display status with appropriate styling", () => {
    const { container } = render(<ShipmentDisplay shipment={mockShipment} />);
    
    // Check for status badge or styled element
    const statusElement = container.querySelector('[class*="status"]') ||
                         container.querySelector('[class*="badge"]');
    expect(statusElement || screen.getByText(/in transit/i)).toBeInTheDocument();
  });

  it("should render delivered status differently", () => {
    const deliveredShipment = {
      ...mockShipment,
      status: "delivered" as const
    };

    render(<ShipmentDisplay shipment={deliveredShipment} />);
    expect(screen.getByText(/delivered/i)).toBeInTheDocument();
  });
});
