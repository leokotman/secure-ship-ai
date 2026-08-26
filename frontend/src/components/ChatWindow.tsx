"use client";

import { useState, useRef, useEffect } from "react";
import { ChatApiError, getSession, streamChat } from "@/lib/api";
import type { ShipmentPayload } from "@/lib/api";
import { filterShipmentsForDisplay } from "@/lib/shipmentCards";
import { useSessionStore } from "@/stores/sessionStore";
import { ShipmentDisplay } from "./ShipmentDisplay";
import { VerificationFlow } from "./VerificationFlow";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  /** Full shipment list from stream metadata for this turn. */
  shipments?: ShipmentPayload[];
  /** Tool that produced shipment metadata (e.g. get_shipment_status). */
  shipmentTool?: string;
  /** User text that triggered this assistant turn (for card filtering). */
  triggerUserText?: string;
}

interface ChatErrorState {
  message: string;
  retryable: boolean;
  lastUserMessage?: string;
}

const ESCALATION_SCRIPT: Message[] = [
  {
    id: "esc-1",
    role: "system",
    content: "Thank you for your patience. Connecting you to a human agent…",
  },
  { id: "esc-2", role: "system", content: "🟢 Melany has entered the chat." },
];

const SESSION_STORAGE_KEY = "secureship_session_id";
const POST_VERIFY_PROMPT =
  "I've entered the verification code and I'm now verified. Please continue with my previous shipment request.";

export function ChatWindow() {
  const { sessionId, chatState, firstName, setSessionId, setChatState } =
    useSessionStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ChatErrorState | null>(null);
  const [showEscalationScript, setShowEscalationScript] = useState(false);
  const [modalDismissed, setModalDismissed] = useState(false);
  const [showAllCardIds, setShowAllCardIds] = useState<Set<string>>(
    () => new Set(),
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hydratedSessionRef = useRef<string | null>(null);
  const sendLockRef = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Re-show verification modal when chat re-enters code states.
  useEffect(() => {
    if (chatState === "code_sent" || chatState === "awaiting_code") {
      setModalDismissed(false);
    }
  }, [chatState]);

  // Migrate away from stale localStorage sessions and recover tab-scoped session id.
  useEffect(() => {
    if (typeof window === "undefined") return;

    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    const storedSessionId = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (storedSessionId && !sessionId) {
      setSessionId(storedSessionId);
    }
  }, [sessionId, setSessionId]);

  // Persist current session id only for this browser tab.
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (sessionId) {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    } else {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, [sessionId]);

  // Restore transcript and durable chat state for an existing session.
  useEffect(() => {
    if (!sessionId || hydratedSessionRef.current === sessionId) return;

    let cancelled = false;
    hydratedSessionRef.current = sessionId;

    const hydrateSession = async () => {
      const sessionData = await getSession(sessionId);
      if (!sessionData || cancelled) return;

      setChatState(sessionData.state);
      setMessages(
        sessionData.messages.map((msg, index) => ({
          id: `hist-${index}`,
          role: msg.role,
          content: msg.content,
        })),
      );
    };

    hydrateSession().catch(() => {
      // Silent recovery: chat still works without historical hydration.
    });

    return () => {
      cancelled = true;
    };
  }, [sessionId, setChatState]);

  // Trigger scripted escalation sequence when state transitions to escalated_to_human
  useEffect(() => {
    if (chatState !== "escalated_to_human" || showEscalationScript) return;
    setShowEscalationScript(true);

    let delay = 800;
    ESCALATION_SCRIPT.forEach((msg) => {
      setTimeout(() => {
        setMessages((prev) => [...prev, msg]);
      }, delay);
      delay += 1200;
    });

    setTimeout(() => {
      const greeting = firstName
        ? `Hi ${firstName}, I'm Melany. Let me just read through our chat here… I'm all caught up. How can I help you today?`
        : "Hi there, I'm Melany. Let me review your chat… all caught up! How can I help you?";
      setMessages((prev) => [
        ...prev,
        { id: "esc-3", role: "system", content: greeting },
      ]);
    }, delay);
  }, [chatState, firstName, showEscalationScript]);

  const toChatError = (
    err: unknown,
    lastUserMessage?: string,
  ): ChatErrorState => {
    if (err instanceof ChatApiError) {
      return {
        message: err.message,
        retryable: err.retryable,
        lastUserMessage: err.retryable ? lastUserMessage : undefined,
      };
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return { message, retryable: true, lastUserMessage };
  };

  const streamAssistantResponse = async (
    message: string,
    options?: { hideUserEcho?: boolean },
  ) => {
    const botMessageId = `${Date.now()}-assistant`;
    let fullResponse = "";

    const result = await streamChat(
      { message, session_id: sessionId || undefined },
      (chunk) => {
        fullResponse += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.id === botMessageId) {
            return prev.map((msg) =>
              msg.id === botMessageId ? { ...msg, content: fullResponse } : msg,
            );
          }
          return [
            ...prev,
            {
              id: botMessageId,
              role: "assistant",
              content: fullResponse,
              triggerUserText: options?.hideUserEcho ? undefined : message,
            },
          ];
        });
      },
    );

    if (result.sessionId && result.sessionId !== sessionId) {
      setSessionId(result.sessionId);
    }
    if (result.sessionState) {
      setChatState(result.sessionState);
    }
    // Attach shipment cards to the bot message
    if (result.shipment) {
      const { data, tool } = result.shipment;
      // Prefer single-shipment metadata from get_shipment_status when present.
      const shipments: ShipmentPayload[] =
        data.shipment && tool === "get_shipment_status"
          ? [data.shipment]
          : (data.shipments ?? (data.shipment ? [data.shipment] : []));
      if (shipments.length > 0) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMessageId
              ? {
                  ...msg,
                  shipments,
                  shipmentTool: tool,
                  triggerUserText: message,
                }
              : msg,
          ),
        );
      }
    }
  };

  const runSend = async (
    message: string,
    opts?: { hideUserEcho?: boolean },
  ) => {
    if (sendLockRef.current || isLoading) return;
    sendLockRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      await streamAssistantResponse(message, opts);
    } catch (err) {
      setError(toChatError(err, message));
    } finally {
      setIsLoading(false);
      sendLockRef.current = false;
    }
  };

  const handleVerificationSuccess = async () => {
    setChatState("verified");
    await runSend(POST_VERIFY_PROMPT, { hideUserEcho: true });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sendLockRef.current || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    await runSend(trimmed);
  };

  const handleRetry = async () => {
    if (!error?.retryable || !error.lastUserMessage) return;
    const message = error.lastUserMessage;
    setError(null);
    await runSend(message, { hideUserEcho: true });
  };

  const isEscalated = chatState === "escalated_to_human";
  // Show modal only if we're waiting for code AND not yet verified
  // Modal will auto-close when chatState changes to 'verified' (via chat or modal submission)
  const showModal =
    !modalDismissed &&
    (chatState === "code_sent" || chatState === "awaiting_code");

  return (
    <div
      className={`flex flex-col h-screen min-h-0 transition-colors duration-700 ${
        isEscalated ? "bg-emerald-50" : "bg-gray-100"
      }`}
    >
      {/* Verification modal — rendered on demand, not on load */}
      {showModal && (
        <VerificationFlow
          onVerified={handleVerificationSuccess}
          onDismiss={() => setModalDismissed(true)}
        />
      )}

      {/* Header */}
      <header
        className={`border-b p-4 shadow-sm transition-colors duration-700 ${
          isEscalated
            ? "bg-emerald-600 border-emerald-700"
            : "bg-white border-gray-200"
        }`}
      >
        <h1
          className={`text-xl sm:text-2xl font-bold ${
            isEscalated ? "text-white" : "text-gray-900"
          }`}
        >
          {isEscalated ? "🟢 SecureShip — Live Agent" : "SecureShip Chat"}
        </h1>
        <p
          className={`text-sm mt-1 ${
            isEscalated ? "text-emerald-100" : "text-gray-600"
          }`}
        >
          {isEscalated
            ? "You are connected to a human agent"
            : "Chat with our support bot to check your shipments"}
        </p>
      </header>

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 space-y-4"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.length === 0 && !isLoading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center px-4">
              <p className="text-gray-500 text-lg">
                Start a conversation with SecureShip
              </p>
              <p className="text-gray-400 text-sm mt-2">
                Ask about your shipments &mdash; we&apos;ll verify your identity
                first
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const cardFilter =
            msg.shipments && msg.shipments.length > 0
              ? filterShipmentsForDisplay({
                  shipments: msg.shipments,
                  tool: msg.shipmentTool,
                  userText: msg.triggerUserText,
                  assistantText: msg.content,
                })
              : null;
          const showAll = showAllCardIds.has(msg.id);
          const visibleShipments =
            cardFilter == null
              ? []
              : showAll
                ? msg.shipments!
                : cardFilter.visible;
          const showFilterChrome = cardFilter?.isFiltered === true && !showAll;

          return (
            <div
              key={msg.id}
              className={`flex ${
                msg.role === "user"
                  ? "justify-end"
                  : msg.role === "system"
                    ? "justify-center"
                    : "justify-start"
              }`}
            >
              {msg.role === "system" ? (
                <div className="bg-emerald-100 border border-emerald-300 text-emerald-800 px-4 py-2 rounded-full text-sm max-w-[90%]">
                  {msg.content}
                </div>
              ) : (
                <div
                  className={`w-full max-w-[min(100%,24rem)] sm:max-w-md px-4 py-2 rounded-lg ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : isEscalated
                        ? "bg-emerald-700 text-white border border-emerald-600"
                        : "bg-white text-gray-900 border border-gray-200"
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {msg.content}
                  </p>
                  {visibleShipments.length > 0 && (
                    <div className="mt-2 space-y-2 min-w-0">
                      {showFilterChrome && (
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                          <span>Showing 1 of {cardFilter!.total}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setShowAllCardIds((prev) => {
                                const next = new Set(prev);
                                next.add(msg.id);
                                return next;
                              })
                            }
                            className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-md border border-gray-300 bg-gray-50 text-gray-800 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            Show all
                          </button>
                        </div>
                      )}
                      {visibleShipments.map((s) => (
                        <ShipmentDisplay key={s.id} shipment={s} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div
            className="flex justify-start"
            aria-live="polite"
            aria-busy="true"
          >
            <div
              className="bg-white text-gray-900 border border-gray-200 px-4 py-2 rounded-lg"
              role="status"
            >
              <p className="text-sm text-gray-600 animate-pulse">
                {isEscalated ? "Melany is typing…" : "SecureShip is thinking…"}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center" role="alert">
            <div className="bg-red-100 border border-red-300 text-red-800 px-4 py-3 rounded-lg max-w-md w-full">
              <p className="text-sm">{error.message}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {error.retryable && error.lastUserMessage && (
                  <button
                    type="button"
                    onClick={handleRetry}
                    disabled={isLoading}
                    className="min-h-[44px] px-4 py-2 text-sm font-medium rounded-md bg-red-700 text-white hover:bg-red-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    Retry
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="min-h-[44px] px-4 py-2 text-sm font-medium rounded-md border border-red-300 text-red-800 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="bg-white border-t border-gray-200 p-3 sm:p-4 shadow-lg">
        <form
          onSubmit={handleSendMessage}
          className="flex gap-2 items-stretch"
          aria-label="Send a chat message"
        >
          <label htmlFor="chat-message-input" className="sr-only">
            Message
          </label>
          <input
            id="chat-message-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isEscalated ? "Message Melany…" : "Type your message…"}
            disabled={isLoading}
            aria-disabled={isLoading}
            className="flex-1 min-h-[44px] min-w-0 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            aria-busy={isLoading}
            className="min-h-[44px] min-w-[44px] px-5 sm:px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
