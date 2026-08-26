/**
 * ErrorAlert Component Tests
 *
 * Tests for the error alert display component.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import ErrorAlert from "../ErrorAlert";

describe("ErrorAlert", () => {
  it("should not render when error is empty", () => {
    const { container } = render(<ErrorAlert error="" onDismiss={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("should render error message when error is provided", () => {
    render(<ErrorAlert error="Something went wrong" onDismiss={() => {}} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("should call onDismiss when close button is clicked", () => {
    const onDismiss = jest.fn();
    render(<ErrorAlert error="Test error" onDismiss={onDismiss} />);

    const closeButton = screen.getByRole("button");
    fireEvent.click(closeButton);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("should display error with appropriate styling", () => {
    const { container } = render(
      <ErrorAlert error="Critical error" onDismiss={() => {}} />,
    );

    const alert =
      container.querySelector('[role="alert"]') ||
      container.querySelector(".bg-red-100");
    expect(alert).toBeInTheDocument();
  });
});
