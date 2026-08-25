/**
 * DashboardStats Component Tests
 * 
 * Tests for the dashboard statistics cards component.
 */

import { render, screen } from "@testing-library/react";
import DashboardStats from "../DashboardStats";
import type { DashboardStats as Stats } from "@/lib/adminApi";

describe("DashboardStats", () => {
  const mockStats: Stats = {
    total_shipments: 150,
    by_status: {
      label_created: 20,
      in_transit: 45,
      out_for_delivery: 15,
      delivered: 65,
      exception: 5
    },
    recent_shipments: []
  };

  it("should render total shipments count", () => {
    render(<DashboardStats stats={mockStats} />);
    expect(screen.getByText("150")).toBeInTheDocument();
    expect(screen.getByText(/Total Shipments/i)).toBeInTheDocument();
  });

  it("should render in transit count", () => {
    render(<DashboardStats stats={mockStats} />);
    expect(screen.getByText("45")).toBeInTheDocument();
    expect(screen.getByText(/In Transit/i)).toBeInTheDocument();
  });

  it("should render out for delivery count", () => {
    render(<DashboardStats stats={mockStats} />);
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getByText(/Out for Delivery/i)).toBeInTheDocument();
  });

  it("should render delivered count", () => {
    render(<DashboardStats stats={mockStats} />);
    expect(screen.getByText("65")).toBeInTheDocument();
    expect(screen.getByText(/Delivered/i)).toBeInTheDocument();
  });

  it("should handle missing status counts gracefully", () => {
    const statsWithMissing: Stats = {
      total_shipments: 10,
      by_status: {
        delivered: 10
      },
      recent_shipments: []
    };

    render(<DashboardStats stats={statsWithMissing} />);
    
    // Should show 0 for missing statuses
    expect(screen.getByText(/In Transit/i)).toBeInTheDocument();
    expect(screen.getByText(/Out for Delivery/i)).toBeInTheDocument();
  });

  it("should render all stat cards", () => {
    const { container } = render(<DashboardStats stats={mockStats} />);
    
    // Should have 4 stat cards (Total, In Transit, Out for Delivery, Delivered)
    const cards = container.querySelectorAll('[class*="bg-white"]');
    expect(cards.length).toBeGreaterThanOrEqual(4);
  });

  it("should display stats with appropriate color coding", () => {
    const { container } = render(<DashboardStats stats={mockStats} />);
    
    // Check for color-coded text (based on the component implementation)
    const blueText = container.querySelector('[class*="text-blue"]');
    const greenText = container.querySelector('[class*="text-green"]');
    const yellowText = container.querySelector('[class*="text-yellow"]');
    
    expect(blueText || greenText || yellowText).toBeInTheDocument();
  });
});
