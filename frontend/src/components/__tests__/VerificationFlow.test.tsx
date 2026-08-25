/**
 * VerificationFlow Component Tests
 * 
 * Tests for the SMS verification modal component (Week 2 feature).
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { VerificationFlow } from "../VerificationFlow";
import { useSessionStore } from "@/stores/sessionStore";

const mockVerifySmsCode = jest.fn();

jest.mock("@/lib/api", () => ({
  verifySmsCode: (...args: unknown[]) => mockVerifySmsCode(...args),
}));

describe("VerificationFlow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSessionStore.setState({
      sessionId: "test-session",
      chatState: "anonymous",
      firstName: null,
    });
  });

  it("should render the verification form", () => {
    useSessionStore.setState({ chatState: "anonymous" });

    const { container } = render(
      <VerificationFlow onVerified={jest.fn()} />
    );

    // Component always renders when mounted (parent decides when to show it)
    expect(container.firstChild).not.toBeNull();
    expect(screen.getByPlaceholderText(/000000/i)).toBeInTheDocument();
  });

  it("should render verification modal when chatState is code_sent", () => {
    useSessionStore.setState({ 
      sessionId: "sess-123",
      chatState: "code_sent" 
    });
    
    render(<VerificationFlow onVerified={jest.fn()} />);
    
    expect(screen.getByPlaceholderText(/000000/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /verify/i })).toBeInTheDocument();
  });

  it("should render verification modal when chatState is awaiting_code", () => {
    useSessionStore.setState({
      sessionId: "sess-123",
      chatState: "awaiting_code"
    });

    render(<VerificationFlow onVerified={jest.fn()} />);

    expect(screen.getByPlaceholderText(/000000/i)).toBeInTheDocument();
  });

  it("should accept 6-digit code input", () => {
    useSessionStore.setState({
      sessionId: "sess-123",
      chatState: "code_sent"
    });
    
    render(<VerificationFlow onVerified={jest.fn()} />);
    
    const input = screen.getByPlaceholderText(/000000/i);
    fireEvent.change(input, { target: { value: "123456" } });
    
    expect(input).toHaveValue("123456");
  });

  it("should call verifySmsCode when verify button is clicked with valid code", async () => {
    useSessionStore.setState({
      sessionId: "sess-456",
      chatState: "code_sent"
    });

    mockVerifySmsCode.mockResolvedValue({
      verified: true,
      state: "verified"
    });

    const onComplete = jest.fn();
    render(<VerificationFlow onVerified={onComplete} />);
    
    const input = screen.getByPlaceholderText(/000000/i);
    fireEvent.change(input, { target: { value: "123456" } });
    
    const verifyButton = screen.getByRole("button", { name: /verify/i });
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(mockVerifySmsCode).toHaveBeenCalledWith({
        session_id: "sess-456",
        code: "123456"
      });
    });
  });

  it("should display error message when verification fails", async () => {
    useSessionStore.setState({
      sessionId: "sess-789",
      chatState: "awaiting_code"
    });

    mockVerifySmsCode.mockResolvedValue({
      verified: false,
      state: "awaiting_code",
      reason: "invalid_code",
      remaining_attempts: 2
    });

    render(<VerificationFlow onVerified={jest.fn()} />);
    
    const input = screen.getByPlaceholderText(/000000/i);
    fireEvent.change(input, { target: { value: "000000" } });
    
    const verifyButton = screen.getByRole("button", { name: /verify/i });
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(screen.getByText(/incorrect/i)).toBeInTheDocument();
    });
  });

  it("should call onVerificationComplete when verification succeeds", async () => {
    useSessionStore.setState({
      sessionId: "sess-success",
      chatState: "code_sent"
    });

    mockVerifySmsCode.mockResolvedValue({
      verified: true,
      state: "verified"
    });

    const onComplete = jest.fn();
    render(<VerificationFlow onVerified={onComplete} />);
    
    const input = screen.getByPlaceholderText(/000000/i);
    fireEvent.change(input, { target: { value: "123456" } });
    
    fireEvent.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });
  });

  it("should handle max attempts lockout", async () => {
    useSessionStore.setState({
      sessionId: "sess-lockout",
      chatState: "awaiting_code"
    });

    mockVerifySmsCode.mockResolvedValue({
      verified: false,
      state: "collecting_identity",
      reason: "max_attempts_exceeded"
    });

    const onComplete = jest.fn();
    render(<VerificationFlow onVerified={onComplete} />);

    const input = screen.getByPlaceholderText(/000000/i);
    fireEvent.change(input, { target: { value: "999999" } });

    fireEvent.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() => {
      // Should show error message
      expect(screen.getByText(/Too many incorrect attempts/i)).toBeInTheDocument();
    });

    // Chat state should be updated but modal stays open showing error
    expect(mockVerifySmsCode).toHaveBeenCalled();
    // onVerified should NOT be called on lockout
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("should disable verify button while submitting", async () => {
    useSessionStore.setState({
      sessionId: "sess-submit",
      chatState: "code_sent"
    });

    mockVerifySmsCode.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        verified: true,
        state: "verified"
      }), 100))
    );

    render(<VerificationFlow onVerified={jest.fn()} />);
    
    const input = screen.getByPlaceholderText(/000000/i);
    fireEvent.change(input, { target: { value: "123456" } });
    
    const verifyButton = screen.getByRole("button", { name: /verify/i });
    fireEvent.click(verifyButton);

    // Button should be disabled while submitting
    expect(verifyButton).toBeDisabled();
  });

  it("calls onDismiss when Escape is pressed", () => {
    const onDismiss = jest.fn();
    useSessionStore.setState({
      sessionId: "sess-esc",
      chatState: "awaiting_code",
    });

    render(
      <VerificationFlow onVerified={jest.fn()} onDismiss={onDismiss} />,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
