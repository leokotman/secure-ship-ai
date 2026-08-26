/**
 * CreateShipmentForm Component Tests
 *
 * Tests for the create shipment form modal component.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CreateShipmentForm from "../CreateShipmentForm";
import { adminApi } from "@/lib/adminApi";

jest.mock("@/lib/adminApi", () => ({
  adminApi: {
    createShipment: jest.fn(),
  },
}));

describe("CreateShipmentForm", () => {
  const mockOnSuccess = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render form with all required fields", () => {
    render(
      <CreateShipmentForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />,
    );

    expect(screen.getByPlaceholderText(/615bbe4a/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/SHIP-001/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/FedEx/i)).toBeInTheDocument();
    // Status select exists
    const statusSelect = screen.getByRole("combobox");
    expect(statusSelect).toBeInTheDocument();
    expect(statusSelect).toHaveValue("label_created");
    expect(screen.getByPlaceholderText(/New York, NY/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Los Angeles, CA/i)).toBeInTheDocument();
  });

  it("should render optional estimated delivery field", () => {
    render(
      <CreateShipmentForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />,
    );

    const deliveryInput = document.querySelector(
      'input[type="datetime-local"]',
    );
    expect(deliveryInput).toBeInTheDocument();
  });

  it("should render cancel and create buttons", () => {
    render(
      <CreateShipmentForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />,
    );

    expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Create Shipment/i }),
    ).toBeInTheDocument();
  });

  it("should call onCancel when cancel button is clicked", () => {
    render(
      <CreateShipmentForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />,
    );

    const cancelButtons = screen.getAllByRole("button", { name: /Cancel/i });
    fireEvent.click(cancelButtons[0]);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it("should update form fields when user types", () => {
    render(
      <CreateShipmentForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />,
    );

    const customerIdInput = screen.getByPlaceholderText(/615bbe4a/i);
    fireEvent.change(customerIdInput, {
      target: { value: "615bbe4a-2716-4322-8006-b5e2d759689f" },
    });

    expect(customerIdInput).toHaveValue("615bbe4a-2716-4322-8006-b5e2d759689f");
  });

  it("should allow selecting different status options", () => {
    render(
      <CreateShipmentForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />,
    );

    const statusSelect = screen.getByRole("combobox");
    fireEvent.change(statusSelect, { target: { value: "in_transit" } });

    expect(statusSelect).toHaveValue("in_transit");
  });

  it("should submit form with valid data", async () => {
    (adminApi.createShipment as jest.Mock).mockResolvedValue({
      id: "ship-123",
      customer_id: "cust-456",
      tracking_number: "SHIP-001",
      status: "label_created",
      carrier: "FedEx",
      origin: "New York, NY",
      destination: "Los Angeles, CA",
    });

    render(
      <CreateShipmentForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />,
    );

    // Fill in required fields
    fireEvent.change(screen.getByPlaceholderText(/615bbe4a/i), {
      target: { value: "cust-456" },
    });
    fireEvent.change(screen.getByPlaceholderText(/SHIP-001/i), {
      target: { value: "SHIP-001" },
    });
    fireEvent.change(screen.getByPlaceholderText(/FedEx/i), {
      target: { value: "FedEx" },
    });
    fireEvent.change(screen.getByPlaceholderText(/New York, NY/i), {
      target: { value: "New York, NY" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Los Angeles, CA/i), {
      target: { value: "Los Angeles, CA" },
    });

    // Submit form
    fireEvent.click(screen.getByRole("button", { name: /Create Shipment/i }));

    await waitFor(() => {
      expect(adminApi.createShipment).toHaveBeenCalledWith({
        customer_id: "cust-456",
        tracking_number: "SHIP-001",
        status: "label_created",
        carrier: "FedEx",
        origin: "New York, NY",
        destination: "Los Angeles, CA",
        estimated_delivery: undefined,
      });
    });

    expect(mockOnSuccess).toHaveBeenCalledTimes(1);
  });

  it("should display error message when submission fails", async () => {
    (adminApi.createShipment as jest.Mock).mockRejectedValue({
      response: {
        data: {
          detail: "Customer not found",
        },
      },
    });

    render(
      <CreateShipmentForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />,
    );

    // Fill in and submit form
    fireEvent.change(screen.getByPlaceholderText(/615bbe4a/i), {
      target: { value: "invalid-id" },
    });
    fireEvent.change(screen.getByPlaceholderText(/SHIP-001/i), {
      target: { value: "SHIP-001" },
    });
    fireEvent.change(screen.getByPlaceholderText(/FedEx/i), {
      target: { value: "FedEx" },
    });
    fireEvent.change(screen.getByPlaceholderText(/New York, NY/i), {
      target: { value: "New York, NY" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Los Angeles, CA/i), {
      target: { value: "Los Angeles, CA" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Create Shipment/i }));

    await waitFor(() => {
      expect(screen.getByText(/Customer not found/i)).toBeInTheDocument();
    });

    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  it("should disable submit button while submitting", async () => {
    (adminApi.createShipment as jest.Mock).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({}), 100)),
    );

    render(
      <CreateShipmentForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />,
    );

    // Fill in required fields
    fireEvent.change(screen.getByPlaceholderText(/615bbe4a/i), {
      target: { value: "cust-456" },
    });
    fireEvent.change(screen.getByPlaceholderText(/SHIP-001/i), {
      target: { value: "SHIP-001" },
    });
    fireEvent.change(screen.getByPlaceholderText(/FedEx/i), {
      target: { value: "FedEx" },
    });
    fireEvent.change(screen.getByPlaceholderText(/New York, NY/i), {
      target: { value: "New York, NY" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Los Angeles, CA/i), {
      target: { value: "Los Angeles, CA" },
    });

    const submitButton = screen.getByRole("button", {
      name: /Create Shipment/i,
    });
    fireEvent.click(submitButton);

    expect(submitButton).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Creating.../i }),
    ).toBeInTheDocument();
  });

  it("should include estimated delivery if provided", async () => {
    (adminApi.createShipment as jest.Mock).mockResolvedValue({});

    render(
      <CreateShipmentForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />,
    );

    // Fill in all fields including estimated delivery
    fireEvent.change(screen.getByPlaceholderText(/615bbe4a/i), {
      target: { value: "cust-456" },
    });
    fireEvent.change(screen.getByPlaceholderText(/SHIP-001/i), {
      target: { value: "SHIP-001" },
    });
    fireEvent.change(screen.getByPlaceholderText(/FedEx/i), {
      target: { value: "FedEx" },
    });
    fireEvent.change(screen.getByPlaceholderText(/New York, NY/i), {
      target: { value: "New York, NY" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Los Angeles, CA/i), {
      target: { value: "Los Angeles, CA" },
    });
    const deliveryInput = document.querySelector(
      'input[type="datetime-local"]',
    ) as HTMLInputElement;
    fireEvent.change(deliveryInput, {
      target: { value: "2024-03-15T12:00" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Create Shipment/i }));

    await waitFor(() => {
      expect(adminApi.createShipment).toHaveBeenCalledWith(
        expect.objectContaining({
          estimated_delivery: "2024-03-15T12:00",
        }),
      );
    });
  });
});
