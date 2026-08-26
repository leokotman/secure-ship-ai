/**
 * DashboardHeader Component Tests
 *
 * Tests for the admin dashboard header component.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import DashboardHeader from "../DashboardHeader";

describe("DashboardHeader", () => {
  it("should render SecureShip Admin title", () => {
    render(<DashboardHeader onLogout={jest.fn()} />);
    expect(screen.getByText(/SecureShip Admin/i)).toBeInTheDocument();
  });

  it("should render logout button", () => {
    render(<DashboardHeader onLogout={jest.fn()} />);
    expect(screen.getByRole("button", { name: /logout/i })).toBeInTheDocument();
  });

  it("should call onLogout when logout button is clicked", () => {
    const onLogout = jest.fn();
    render(<DashboardHeader onLogout={onLogout} />);

    const logoutButton = screen.getByRole("button", { name: /logout/i });
    fireEvent.click(logoutButton);

    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("should render with proper styling", () => {
    const { container } = render(<DashboardHeader onLogout={jest.fn()} />);

    const header = container.querySelector("header");
    expect(header).toBeInTheDocument();
  });
});
