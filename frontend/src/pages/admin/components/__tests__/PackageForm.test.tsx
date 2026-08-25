/**
 * PackageForm Component Tests
 * 
 * Tests for the package creation form modal component.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PackageForm from "../PackageForm";
import { adminApi } from "@/lib/adminApi";

jest.mock("@/lib/adminApi", () => ({
  adminApi: {
    createPackage: jest.fn()
  }
}));

describe("PackageForm", () => {
  const mockOnSuccess = jest.fn();
  const mockOnCancel = jest.fn();
  const shipmentId = "ship-123";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render modal with form fields", () => {
    render(
      <PackageForm
        shipmentId={shipmentId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText(/Add Package/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Electronics, Documents, etc\./i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/2\.5/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/100\.00/i)).toBeInTheDocument();
  });

  it("should render cancel and create buttons", () => {
    render(
      <PackageForm
        shipmentId={shipmentId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create Package/i })).toBeInTheDocument();
  });

  it("should call onCancel when cancel button is clicked", () => {
    render(
      <PackageForm
        shipmentId={shipmentId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it("should update form fields when user types", () => {
    render(
      <PackageForm
        shipmentId={shipmentId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    const descriptionInput = screen.getByPlaceholderText(/Electronics, Documents, etc\./i);
    fireEvent.change(descriptionInput, { target: { value: "Electronics" } });
    expect(descriptionInput).toHaveValue("Electronics");

    const weightInput = screen.getByPlaceholderText(/2\.5/i);
    fireEvent.change(weightInput, { target: { value: "2.5" } });
    expect(weightInput).toHaveValue(2.5);

    const valueInput = screen.getByPlaceholderText(/100\.00/i);
    fireEvent.change(valueInput, { target: { value: "500.00" } });
    expect(valueInput).toHaveValue(500);
  });

  it("should submit form with valid data", async () => {
    (adminApi.createPackage as jest.Mock).mockResolvedValue({
      id: "pkg-123",
      shipment_id: shipmentId,
      description: "Electronics",
      weight_kg: "2.5",
      declared_value: "500.00"
    });

    render(
      <PackageForm
        shipmentId={shipmentId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/Electronics, Documents, etc\./i), {
      target: { value: "Electronics" }
    });
    fireEvent.change(screen.getByPlaceholderText(/2\.5/i), {
      target: { value: "2.5" }
    });
    fireEvent.change(screen.getByPlaceholderText(/100\.00/i), {
      target: { value: "500.00" }
    });

    fireEvent.click(screen.getByRole("button", { name: /Create Package/i }));

    await waitFor(() => {
      expect(adminApi.createPackage).toHaveBeenCalledWith({
        shipment_id: shipmentId,
        description: "Electronics",
        weight_kg: 2.5,
        declared_value: 500.0
      });
    });

    expect(mockOnSuccess).toHaveBeenCalledTimes(1);
  });

  it("should display error message when submission fails", async () => {
    (adminApi.createPackage as jest.Mock).mockRejectedValue({
      response: {
        data: {
          detail: "Shipment not found"
        }
      }
    });

    render(
      <PackageForm
        shipmentId={shipmentId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/Electronics, Documents, etc\./i), {
      target: { value: "Electronics" }
    });
    fireEvent.change(screen.getByPlaceholderText(/2\.5/i), {
      target: { value: "2.5" }
    });
    fireEvent.change(screen.getByPlaceholderText(/100\.00/i), {
      target: { value: "500.00" }
    });

    fireEvent.click(screen.getByRole("button", { name: /Create Package/i }));

    await waitFor(() => {
      expect(screen.getByText(/Shipment not found/i)).toBeInTheDocument();
    });

    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  it("should disable buttons while submitting", async () => {
    (adminApi.createPackage as jest.Mock).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({}), 100))
    );

    render(
      <PackageForm
        shipmentId={shipmentId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/Electronics, Documents, etc\./i), {
      target: { value: "Electronics" }
    });
    fireEvent.change(screen.getByPlaceholderText(/2\.5/i), {
      target: { value: "2.5" }
    });
    fireEvent.change(screen.getByPlaceholderText(/100\.00/i), {
      target: { value: "500.00" }
    });

    const submitButton = screen.getByRole("button", { name: /Create Package/i });
    fireEvent.click(submitButton);

    expect(submitButton).toBeDisabled();
    expect(screen.getByRole("button", { name: /Creating.../i })).toBeInTheDocument();
  });

  it("should validate required fields", async () => {
    render(
      <PackageForm
        shipmentId={shipmentId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    // Try to submit without filling fields
    const submitButton = screen.getByRole("button", { name: /Create Package/i });
    fireEvent.click(submitButton);

    // Form should not submit (HTML5 validation)
    await waitFor(() => {
      expect(adminApi.createPackage).not.toHaveBeenCalled();
    });
  });

  it("should parse numeric values correctly", async () => {
    (adminApi.createPackage as jest.Mock).mockResolvedValue({});

    render(
      <PackageForm
        shipmentId={shipmentId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/Electronics, Documents, etc\./i), {
      target: { value: "Test Item" }
    });
    fireEvent.change(screen.getByPlaceholderText(/2\.5/i), {
      target: { value: "1.23" }
    });
    fireEvent.change(screen.getByPlaceholderText(/100\.00/i), {
      target: { value: "99.99" }
    });

    fireEvent.click(screen.getByRole("button", { name: /Create Package/i }));

    await waitFor(() => {
      expect(adminApi.createPackage).toHaveBeenCalledWith({
        shipment_id: shipmentId,
        description: "Test Item",
        weight_kg: 1.23,
        declared_value: 99.99
      });
    });
  });

  it("should render modal overlay", () => {
    const { container } = render(
      <PackageForm
        shipmentId={shipmentId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    // Should have modal overlay styling
    const modal = container.querySelector('.fixed.inset-0') || 
                  container.querySelector('[class*="bg-gray-500"]');
    expect(modal).toBeInTheDocument();
  });
});
