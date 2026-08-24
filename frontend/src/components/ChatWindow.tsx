"use client";

import { useState, useRef, useEffect } from "react";
import { getSession, streamChat } from "@/lib/api";
import type { ShipmentPayload } from "@/lib/api";
import { useSessionStore } from "@/stores/sessionStore";
import { ShipmentDisplay } from "./ShipmentDisplay";
import { VerificationFlow } from "./VerificationFlow";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  /** Shipment(s) attached when a shipment tool returned data this turn. */
  shipments?: ShipmentPayload[];
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
  const [error, setError] = useState<string | null>(null);
  const [showEscalationScript, setShowEscalationScript] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hydratedSessionRef = useRef<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  const streamAssistantResponse = async (message: string) => {
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
            { id: botMessageId, role: "assistant", content: fullResponse },
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
      const { data } = result.shipment;
      const shipments: ShipmentPayload[] =
        data.shipments ?? (data.shipment ? [data.shipment] : []);
      if (shipments.length > 0) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMessageId ? { ...msg, shipments } : msg,
          ),
        );
      }
    }
  };

  const handleVerificationSuccess = async () => {
    setChatState("verified");
    setIsLoading(true);
    setError(null);

    try {
      await streamAssistantResponse(POST_VERIFY_PROMPT);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      await streamAssistantResponse(input);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const isEscalated = chatState === "escalated_to_human";
  // Show modal only if we're waiting for code AND not yet verified
  // Modal will auto-close when chatState changes to 'verified' (via chat or modal submission)
  const showModal = chatState === "code_sent" || chatState === "awaiting_code";

  return (
    <div
      className={`flex flex-col h-screen transition-colors duration-700 ${
        isEscalated ? "bg-emerald-50" : "bg-gray-100"
      }`}
    >
      {/* Verification modal — rendered on demand, not on load */}
      {showModal && <VerificationFlow onVerified={handleVerificationSuccess} />}

      {/* Header */}
      <div
        className={`border-b p-4 shadow-sm transition-colors duration-700 ${
          isEscalated
            ? "bg-emerald-600 border-emerald-700"
            : "bg-white border-gray-200"
        }`}
      >
        <h1
          className={`text-2xl font-bold ${
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
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
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

        {messages.map((msg) => (
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
              <div className="bg-emerald-100 border border-emerald-300 text-emerald-800 px-4 py-2 rounded-full text-sm">
                {msg.content}
              </div>
            ) : (
              <div
                className={`max-w-xs px-4 py-2 rounded-lg ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : isEscalated
                      ? "bg-emerald-700 text-white border border-emerald-600"
                      : "bg-white text-gray-900 border border-gray-200"
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </p>
                {msg.shipments && msg.shipments.length > 0 && (
                  <div className="space-y-2">
                    {msg.shipments.map((s) => (
                      <ShipmentDisplay key={s.id} shipment={s} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white text-gray-900 border border-gray-200 px-4 py-2 rounded-lg">
              <p className="text-sm text-gray-600 animate-pulse">
                {isEscalated ? "Melany is typing…" : "SecureShip is thinking…"}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center">
            <div className="bg-red-100 border border-red-300 text-red-800 px-4 py-2 rounded-lg">
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="bg-white border-t border-gray-200 p-4 shadow-lg">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isEscalated ? "Message Melany…" : "Type your message…"}
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
