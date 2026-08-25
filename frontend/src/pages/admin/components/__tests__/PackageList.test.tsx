/**
 * PackageList Component Tests
 * 
 * Tests for the package list display component.
 */

import { render, screen } from "@testing-library/react";
import PackageList from "../PackageList";
import type { Package } from "@/lib/adminApi";

describe("PackageList", () => {
  const mockPackages: Package[] = [
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
  ];

  it("should render nothing when packages array is empty", () => {
    const { container } = render(<PackageList packages={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("should render nothing when packages is null/undefined", () => {
    const { container } = render(<PackageList packages={null as any} />);
    expect(container.firstChild).toBeNull();
  });

  it("should display package count", () => {
    render(<PackageList packages={mockPackages} />);
    expect(screen.getByText(/Packages \(2\)/i)).toBeInTheDocument();
  });

  it("should render all package descriptions", () => {
    render(<PackageList packages={mockPackages} />);
    expect(screen.getByText("Electronics")).toBeInTheDocument();
    expect(screen.getByText("Documents")).toBeInTheDocument();
  });

  it("should display package weights", () => {
    render(<PackageList packages={mockPackages} />);
    expect(screen.getByText(/2.5kg/i)).toBeInTheDocument();
    expect(screen.getByText(/0.5kg/i)).toBeInTheDocument();
  });

  it("should display package declared values", () => {
    render(<PackageList packages={mockPackages} />);
    const values = screen.getAllByText(/\$500/);
    expect(values.length).toBeGreaterThan(0);
    const values2 = screen.getAllByText(/\$50/);
    expect(values2.length).toBeGreaterThan(0);
  });

  it("should render single package correctly", () => {
    const singlePackage: Package[] = [
      {
        id: "pkg-1",
        shipment_id: "ship-123",
        description: "Single Item",
        weight_kg: "1.0",
        declared_value: "100.00"
      }
    ];

    render(<PackageList packages={singlePackage} />);
    expect(screen.getByText(/Packages \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText("Single Item")).toBeInTheDocument();
  });

  it("should render package list as an unordered list", () => {
    const { container } = render(<PackageList packages={mockPackages} />);
    const list = container.querySelector("ul");
    expect(list).toBeInTheDocument();
  });

  it("should render each package as a list item", () => {
    const { container } = render(<PackageList packages={mockPackages} />);
    const listItems = container.querySelectorAll("li");
    expect(listItems.length).toBe(2);
  });

  it("should display package information in a readable format", () => {
    render(<PackageList packages={mockPackages} />);
    
    // Check that all information is present for first package
    expect(screen.getByText("Electronics")).toBeInTheDocument();
    expect(screen.getByText(/2.5kg/i)).toBeInTheDocument();
    expect(screen.getByText(/\$500/i)).toBeInTheDocument();
  });

  it("should handle packages with decimal values", () => {
    const packagesWithDecimals: Package[] = [
      {
        id: "pkg-1",
        shipment_id: "ship-123",
        description: "Fragile Item",
        weight_kg: "0.75",
        declared_value: "123.45"
      }
    ];

    render(<PackageList packages={packagesWithDecimals} />);
    expect(screen.getByText(/0.75kg/i)).toBeInTheDocument();
    expect(screen.getByText(/\$123.45/i)).toBeInTheDocument();
  });
});
