import type { NextApiRequest, NextApiResponse } from 'next';

interface ChatRequestBody {
    message?: unknown;
    session_id?: unknown;
}

const BACKEND_BASE_URL =
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:8000';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
): Promise<void> {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const body = req.body as ChatRequestBody;
    if (typeof body?.message !== 'string' || !body.message.trim()) {
        res.status(400).json({ error: 'message must be a non-empty string' });
        return;
    }

    const payload: { message: string; session_id?: string } = {
        message: body.message,
    };

    if (typeof body.session_id === 'string' && body.session_id.trim()) {
        payload.session_id = body.session_id;
    }

    try {
        const upstreamResponse = await fetch(`${BACKEND_BASE_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!upstreamResponse.ok) {
            const errorText = await upstreamResponse.text();
            res.status(upstreamResponse.status).json({
                error: errorText || `Upstream chat error: ${upstreamResponse.statusText}`,
            });
            return;
        }

        const reader = upstreamResponse.body?.getReader();
        if (!reader) {
            res.status(502).json({ error: 'Upstream response body is not readable' });
            return;
        }

        const contentType = upstreamResponse.headers.get('content-type');
        res.status(200);
        res.setHeader('Content-Type', contentType || 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                if (value) {
                    res.write(Buffer.from(value));
                }
            }
        } finally {
            reader.releaseLock();
            res.end();
        }
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Failed to reach chat service';
        res.status(502).json({ error: message });
    }
}
