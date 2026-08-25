/**
 * SessionStore Tests
 * 
 * Tests for the Zustand session state management store (Week 2 feature).
 */

import { renderHook, act } from "@testing-library/react";
import { useSessionStore } from "../../stores/sessionStore";

describe("useSessionStore", () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    act(() => {
      useSessionStore.setState({
        sessionId: "",
        chatState: "anonymous",
        firstName: null
      });
    });
  });

  it("should have initial state", () => {
    const { result } = renderHook(() => useSessionStore());

    expect(result.current.sessionId).toBe("");
    expect(result.current.chatState).toBe("anonymous");
    expect(result.current.firstName).toBe(null);
  });

  it("should update sessionId", () => {
    const { result } = renderHook(() => useSessionStore());

    act(() => {
      useSessionStore.setState({ sessionId: "sess-123" });
    });

    expect(result.current.sessionId).toBe("sess-123");
  });

  it("should update chatState", () => {
    const { result } = renderHook(() => useSessionStore());

    act(() => {
      useSessionStore.setState({ chatState: "collecting_identity" });
    });

    expect(result.current.chatState).toBe("collecting_identity");
  });

  it("should update firstName", () => {
    const { result } = renderHook(() => useSessionStore());

    act(() => {
      useSessionStore.setState({ firstName: "John" });
    });

    expect(result.current.firstName).toBe("John");
  });

  it("should handle all chat state transitions", () => {
    const { result } = renderHook(() => useSessionStore());

    const states = [
      "anonymous",
      "collecting_identity",
      "code_sent",
      "awaiting_code",
      "verified",
      "escalated_to_human"
    ];

    states.forEach(state => {
      act(() => {
        useSessionStore.setState({ chatState: state as any });
      });
      expect(result.current.chatState).toBe(state);
    });
  });

  it("should update multiple fields at once", () => {
    const { result } = renderHook(() => useSessionStore());

    act(() => {
      useSessionStore.setState({
        sessionId: "sess-456",
        chatState: "verified",
        firstName: "Jane"
      });
    });

    expect(result.current.sessionId).toBe("sess-456");
    expect(result.current.chatState).toBe("verified");
    expect(result.current.firstName).toBe("Jane");
  });

  it("should maintain state across multiple hook instances", () => {
    const { result: result1 } = renderHook(() => useSessionStore());
    const { result: result2 } = renderHook(() => useSessionStore());

    act(() => {
      useSessionStore.setState({ sessionId: "shared-session" });
    });

    expect(result1.current.sessionId).toBe("shared-session");
    expect(result2.current.sessionId).toBe("shared-session");
  });

  it("should handle verification flow state progression", () => {
    const { result } = renderHook(() => useSessionStore());

    // Anonymous -> collecting identity
    act(() => {
      useSessionStore.setState({ 
        sessionId: "sess-flow",
        chatState: "anonymous" 
      });
    });
    expect(result.current.chatState).toBe("anonymous");

    // Collecting identity
    act(() => {
      useSessionStore.setState({ chatState: "collecting_identity" });
    });
    expect(result.current.chatState).toBe("collecting_identity");

    // Code sent
    act(() => {
      useSessionStore.setState({ chatState: "code_sent" });
    });
    expect(result.current.chatState).toBe("code_sent");

    // Awaiting code
    act(() => {
      useSessionStore.setState({ chatState: "awaiting_code" });
    });
    expect(result.current.chatState).toBe("awaiting_code");

    // Verified
    act(() => {
      useSessionStore.setState({ 
        chatState: "verified",
        firstName: "Sarah"
      });
    });
    expect(result.current.chatState).toBe("verified");
    expect(result.current.firstName).toBe("Sarah");
  });

  it("should handle escalation state", () => {
    const { result } = renderHook(() => useSessionStore());

    act(() => {
      useSessionStore.setState({
        sessionId: "sess-escalated",
        chatState: "escalated_to_human",
        firstName: "Mike"
      });
    });

    expect(result.current.chatState).toBe("escalated_to_human");
    expect(result.current.firstName).toBe("Mike");
  });

  it("should allow firstName to be set to null", () => {
    const { result } = renderHook(() => useSessionStore());

    act(() => {
      useSessionStore.setState({ firstName: "Test" });
    });
    expect(result.current.firstName).toBe("Test");

    act(() => {
      useSessionStore.setState({ firstName: null });
    });
    expect(result.current.firstName).toBe(null);
  });

  it("should persist state when only one field is updated", () => {
    const { result } = renderHook(() => useSessionStore());

    act(() => {
      useSessionStore.setState({
        sessionId: "sess-persist",
        chatState: "verified",
        firstName: "Alice"
      });
    });

    // Update only chatState
    act(() => {
      useSessionStore.setState({ chatState: "escalated_to_human" });
    });

    // Other fields should remain unchanged
    expect(result.current.sessionId).toBe("sess-persist");
    expect(result.current.chatState).toBe("escalated_to_human");
    expect(result.current.firstName).toBe("Alice");
  });
});
