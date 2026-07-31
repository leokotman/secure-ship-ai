/**
 * API client for frontend-backend communication.
 */

export interface ChatRequest {
  message: string;
  session_id?: string;
}

/**
 * Send a message to the chat endpoint and stream the response.
 *
 * @param request - Chat request with message and optional session_id
 * @param onChunk - Callback invoked for each streamed text chunk
 * @returns Promise that resolves when streaming completes
 */
export async function streamChat(
  request: ChatRequest,
  onChunk: (chunk: string) => void
): Promise<string | undefined> {
  // Browser only talks to the local BFF route; backend URL stays server-side.
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
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

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      onChunk(chunk);
    }

    const sessionId = response.headers.get('x-session-id') || undefined;
    return sessionId;
  } finally {
    reader.releaseLock();
  }
}
