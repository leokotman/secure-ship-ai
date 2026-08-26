/**
 * API client for frontend-backend communication.
 *
 * All backend calls go through the BFF proxy at /api/chat — the backend URL
 * never reaches the browser.
 */

import type { ChatRequest as GeneratedChatRequest } from "@/lib/generated/schemas";
import type { ChatState } from "@/stores/sessionStore";

/** BFF chat request — aligns with Orval `ChatRequest` (message + optional session). */
export type ChatRequest = GeneratedChatRequest;

export interface ShipmentPackage {
  description: string;
  weight_kg: string;
  declared_value: string;
}

export interface ShipmentPayload {
  id: string;
  tracking_number: string;
  status: string;
  carrier: string;
  origin: string;
  destination: string;
  estimated_delivery: string | null;
  last_update: string | null;
  packages: ShipmentPackage[];
}

export interface StreamChatResult {
  sessionId?: string;
  sessionState?: ChatState;
  /** Present when a shipment tool returned status=ok this turn. */
  shipment?: {
    tool: string;
    data: { shipments?: ShipmentPayload[]; shipment?: ShipmentPayload };
  };
}

export class ChatApiError extends Error {
  readonly status: number;
  readonly retryAfterSeconds?: number;
  readonly retryable: boolean;

  constructor(
    message: string,
    options: {
      status: number;
      retryAfterSeconds?: number;
      retryable?: boolean;
    },
  ) {
    super(message);
    this.name = "ChatApiError";
    this.status = options.status;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.retryable =
      options.retryable ?? (options.status >= 500 || options.status === 429);
  }
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number.parseInt(header, 10);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

/**
 * Send a message to the chat endpoint and stream the response.
 *
 * Text chunks are passed to onChunk as they arrive.
 *
 * The backend appends a null-byte prefixed JSON metadata event at the very end
 * of the stream carrying the updated session state. This function parses that
 * event, strips it from the display content, and returns it in the result.
 */
export async function streamChat(
  request: ChatRequest,
  onChunk: (chunk: string) => void,
): Promise<StreamChatResult> {
  let response: Response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    throw new ChatApiError(
      "Unable to reach SecureShip. Check your connection and try again.",
      { status: 0, retryable: true },
    );
  }

  if (!response.ok) {
    const retryAfterSeconds = parseRetryAfter(
      response.headers.get("Retry-After"),
    );
    let detail = "";
    try {
      const body = (await response.json()) as {
        error?: string;
        detail?: string;
      };
      detail = body.error || body.detail || "";
    } catch {
      // ignore non-JSON error bodies
    }

    if (response.status === 429) {
      const wait = retryAfterSeconds
        ? ` Try again in ${retryAfterSeconds}s.`
        : "";
      throw new ChatApiError(`You're sending messages too quickly.${wait}`, {
        status: 429,
        retryAfterSeconds,
        retryable: true,
      });
    }

    if (response.status === 400) {
      throw new ChatApiError(detail || "Invalid message. Please try again.", {
        status: 400,
        retryable: false,
      });
    }

    throw new ChatApiError(
      detail || "Chat service is temporarily unavailable. Please try again.",
      {
        status: response.status,
        retryAfterSeconds,
        retryable: response.status >= 500,
      },
    );
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new ChatApiError("Response body is not readable", {
      status: 502,
      retryable: true,
    });
  }

  const decoder = new TextDecoder();
  // Buffer for the JSON metadata that follows a null byte
  const stateBuffer: string[] = [];
  let pastNullByte = false;
  let returnedSessionId = response.headers.get("x-session-id") ?? undefined;
  let sessionState: ChatState | undefined;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const raw = decoder.decode(value, { stream: true });

      if (pastNullByte) {
        // Everything after the null byte is the state JSON
        stateBuffer.push(raw);
        continue;
      }

      const nullIdx = raw.indexOf("\x00");
      if (nullIdx !== -1) {
        // Text before the null byte is normal content
        const textPart = raw.substring(0, nullIdx);
        if (textPart) onChunk(textPart);

        // Everything after is state JSON
        const metaPart = raw.substring(nullIdx + 1);
        if (metaPart) stateBuffer.push(metaPart);
        pastNullByte = true;
      } else {
        onChunk(raw);
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Parse state event
  if (stateBuffer.length > 0) {
    try {
      const meta = JSON.parse(stateBuffer.join("")) as {
        s?: string;
        sid?: string;
        shipment?: StreamChatResult["shipment"];
      };
      if (meta.s) sessionState = meta.s as ChatState;
      if (meta.sid) returnedSessionId = meta.sid;
      if (meta.shipment)
        return {
          sessionId: returnedSessionId,
          sessionState,
          shipment: meta.shipment,
        };
    } catch {
      // Malformed metadata — ignore; UI state stays unchanged
    }
  }

  return { sessionId: returnedSessionId, sessionState };
}

export interface SessionData {
  state: ChatState;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

/**
 * Fetch the persisted state and message history for an existing session.
 * Called on mount to re-hydrate the UI after a page reload.
 * Returns null if the session does not exist yet.
 */
export async function getSession(
  sessionId: string,
): Promise<SessionData | null> {
  const params = new URLSearchParams({ requesting_session_id: sessionId });
  const response = await fetch(
    `/api/session/${encodeURIComponent(sessionId)}?${params.toString()}`,
  );
  if (response.status === 404) return null;
  if (!response.ok) return null;
  return response.json() as Promise<SessionData>;
}

export interface VerifySmsRequest {
  session_id: string;
  code: string;
}

export interface VerifySmsResponse {
  verified: boolean;
  state: ChatState;
  reason?:
    | "expired"
    | "incorrect_code"
    | "max_attempts_exceeded"
    | "code_resent"
    | "no_active_code";
}

/**
 * Submit a 6-digit SMS verification code via the BFF proxy.
 */
export async function verifySmsCode(
  request: VerifySmsRequest,
): Promise<VerifySmsResponse> {
  const response = await fetch("/api/verify-sms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  const payload = (await response.json()) as Partial<VerifySmsResponse>;
  if (!response.ok) {
    if (
      typeof payload.verified === "boolean" &&
      typeof payload.state === "string"
    ) {
      return payload as VerifySmsResponse;
    }
    throw new Error(`Verification API error: ${response.statusText}`);
  }

  return payload as VerifySmsResponse;
}
