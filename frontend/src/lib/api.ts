/**
 * API client for frontend-backend communication.
 *
 * All backend calls go through the BFF proxy at /api/chat — the backend URL
 * never reaches the browser.
 */

import type { ChatState } from '@/stores/sessionStore';

export interface ChatRequest {
  message: string;
  session_id?: string;
}

export interface StreamChatResult {
  sessionId?: string;
  sessionState?: ChatState;
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
  onChunk: (chunk: string) => void
): Promise<StreamChatResult> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Chat API error: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  const decoder = new TextDecoder();
  // Buffer for the JSON metadata that follows a null byte
  const stateBuffer: string[] = [];
  let pastNullByte = false;
  let returnedSessionId = response.headers.get('x-session-id') ?? undefined;
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

      const nullIdx = raw.indexOf('\x00');
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
      const meta = JSON.parse(stateBuffer.join('')) as { s?: string; sid?: string };
      if (meta.s) sessionState = meta.s as ChatState;
      if (meta.sid) returnedSessionId = meta.sid;
    } catch {
      // Malformed metadata — ignore; UI state stays unchanged
    }
  }

  return { sessionId: returnedSessionId, sessionState };
}

export interface VerifySmsRequest {
  session_id: string;
  code: string;
}

export interface VerifySmsResponse {
  verified: boolean;
  state: ChatState;
}

/**
 * Submit a 6-digit SMS verification code via the BFF proxy.
 */
export async function verifySmsCode(
  request: VerifySmsRequest
): Promise<VerifySmsResponse> {
  const response = await fetch('/api/verify-sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Verification API error: ${response.statusText}`);
  }

  return response.json() as Promise<VerifySmsResponse>;
}

