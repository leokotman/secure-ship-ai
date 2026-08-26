import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ChatWindow } from "@/components/ChatWindow";
import { ChatApiError } from "@/lib/api";
import { useSessionStore } from "@/stores/sessionStore";

const mockGetSession = jest.fn();
const mockStreamChat = jest.fn();
const mockVerifySmsCode = jest.fn();

jest.mock("@/lib/api", () => {
  const actual = jest.requireActual("@/lib/api") as typeof import("@/lib/api");
  return {
    ...actual,
    getSession: (...args: unknown[]) => mockGetSession(...args),
    streamChat: (...args: unknown[]) => mockStreamChat(...args),
    verifySmsCode: (...args: unknown[]) => mockVerifySmsCode(...args),
  };
});

describe("ChatWindow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSessionStore.setState({
      sessionId: "",
      chatState: "anonymous",
      firstName: null,
    });
    window.localStorage.clear();
    window.sessionStorage.clear();
    mockGetSession.mockResolvedValue(null);
    mockVerifySmsCode.mockResolvedValue({ verified: true, state: "verified" });
  });

  it("renders user and assistant messages during streaming", async () => {
    mockStreamChat.mockImplementation(
      async (
        _request: { message: string; session_id?: string },
        onChunk: (chunk: string) => void,
      ) => {
        onChunk("I can help with that.");
        return {
          sessionId: "sess-stream",
          sessionState: "collecting_identity",
        };
      },
    );

    render(<ChatWindow />);

    const input = screen.getByPlaceholderText("Type your message…");
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("hello")).toBeInTheDocument();
    expect(
      await screen.findByText("I can help with that."),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(window.sessionStorage.getItem("secureship_session_id")).toBe(
        "sess-stream",
      );
    });

    expect(window.localStorage.getItem("secureship_session_id")).toBeNull();
  });

  it("rehydrates transcript from tab-scoped session id and clears stale localStorage id", async () => {
    window.localStorage.setItem("secureship_session_id", "old-ghost-session");
    window.sessionStorage.setItem("secureship_session_id", "tab-session-1");

    mockGetSession.mockResolvedValue({
      state: "anonymous",
      messages: [
        { role: "user", content: "Where is my package?" },
        {
          role: "assistant",
          content: "Please share your full name and phone.",
        },
      ],
    });

    render(<ChatWindow />);

    expect(await screen.findByText("Where is my package?")).toBeInTheDocument();
    expect(
      await screen.findByText("Please share your full name and phone."),
    ).toBeInTheDocument();

    expect(window.localStorage.getItem("secureship_session_id")).toBeNull();
    expect(mockGetSession).toHaveBeenCalledWith("tab-session-1");
  });

  it("triggers a follow-up chat turn after successful sms verification", async () => {
    useSessionStore.setState({
      sessionId: "sess-post-verify",
      chatState: "code_sent",
      firstName: null,
    });

    mockStreamChat.mockImplementation(
      async (
        _request: { message: string; session_id?: string },
        onChunk: (chunk: string) => void,
      ) => {
        onChunk("Verification confirmed. Let me continue.");
        return { sessionId: "sess-post-verify", sessionState: "verified" };
      },
    );

    render(<ChatWindow />);

    const codeInput = await screen.findByPlaceholderText("000000");
    fireEvent.change(codeInput, { target: { value: "072460" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() => {
      expect(mockVerifySmsCode).toHaveBeenCalledWith({
        session_id: "sess-post-verify",
        code: "072460",
      });
    });

    await waitFor(() => {
      expect(mockStreamChat).toHaveBeenCalledWith(
        {
          message:
            "I've entered the verification code and I'm now verified. Please continue with my previous shipment request.",
          session_id: "sess-post-verify",
        },
        expect.any(Function),
      );
    });
  });

  it("closes verification modal after max attempts lockout", async () => {
    useSessionStore.setState({
      sessionId: "sess-lockout",
      chatState: "awaiting_code",
      firstName: null,
    });

    mockVerifySmsCode.mockResolvedValue({
      verified: false,
      state: "collecting_identity",
      reason: "max_attempts_exceeded",
    });

    render(<ChatWindow />);

    const codeInput = await screen.findByPlaceholderText("000000");
    fireEvent.change(codeInput, { target: { value: "999999" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() => {
      expect(screen.queryByPlaceholderText("000000")).not.toBeInTheDocument();
    });
  });

  it("filters shipment cards to one tracking and offers Show all", async () => {
    useSessionStore.setState({
      sessionId: "sess-cards",
      chatState: "verified",
      firstName: "Ada",
    });

    mockStreamChat.mockImplementation(
      async (
        _request: { message: string; session_id?: string },
        onChunk: (chunk: string) => void,
      ) => {
        onChunk("ADMIN-TEST-002 is in transit.");
        return {
          sessionId: "sess-cards",
          sessionState: "verified",
          shipment: {
            tool: "lookup_shipments",
            data: {
              shipments: [
                {
                  id: "s1",
                  tracking_number: "ADMIN-TEST-001",
                  status: "delivered",
                  carrier: "SecureShip",
                  origin: "A",
                  destination: "B",
                  estimated_delivery: null,
                  last_update: null,
                  packages: [],
                },
                {
                  id: "s2",
                  tracking_number: "ADMIN-TEST-002",
                  status: "in_transit",
                  carrier: "SecureShip",
                  origin: "A",
                  destination: "B",
                  estimated_delivery: null,
                  last_update: null,
                  packages: [],
                },
              ],
            },
          },
        };
      },
    );

    render(<ChatWindow />);

    const input = screen.getByPlaceholderText("Type your message…");
    fireEvent.change(input, {
      target: { value: "Tell me about ADMIN-TEST-002" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText(/Showing 1 of 2/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show all" }),
    ).toBeInTheDocument();
    expect(screen.getByText("ADMIN-TEST-002")).toBeInTheDocument();
    expect(screen.queryByText("ADMIN-TEST-001")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(await screen.findByText("ADMIN-TEST-001")).toBeInTheDocument();
    expect(screen.getByText("ADMIN-TEST-002")).toBeInTheDocument();
  });

  it("shows retry on rate-limit errors", async () => {
    useSessionStore.setState({
      sessionId: "sess-429",
      chatState: "anonymous",
      firstName: null,
    });

    mockStreamChat.mockRejectedValue(
      new ChatApiError(
        "You're sending messages too quickly. Try again in 30s.",
        {
          status: 429,
          retryAfterSeconds: 30,
          retryable: true,
        },
      ),
    );

    render(<ChatWindow />);

    const input = screen.getByPlaceholderText("Type your message…");
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(
      await screen.findByText(/sending messages too quickly/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
