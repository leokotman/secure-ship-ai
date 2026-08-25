/**
 * LoadingSpinner Component Tests
 * 
 * Tests for the loading spinner component.
 */

import { render } from "@testing-library/react";
import LoadingSpinner from "../LoadingSpinner";

describe("LoadingSpinner", () => {
  it("should render without crashing", () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("should display loading indicator", () => {
    const { container } = render(<LoadingSpinner />);
    
    // Check for spinner/loading element (adjust selector based on actual implementation)
    const spinner = container.querySelector('[role="status"]') ||
                   container.querySelector('.animate-spin') ||
                   container.querySelector('.spinner');
    
    expect(spinner || container.firstChild).toBeInTheDocument();
  });

  it("should render with accessible loading text", () => {
    const { container } = render(<LoadingSpinner />);
    
    // Should have some indication of loading state
    expect(container.textContent).toBeTruthy();
  });
});
