import type { NextApiRequest, NextApiResponse } from 'next';

const BACKEND_BASE_URL =
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:8000';

const GENERIC_ERROR = 'Session service is temporarily unavailable.';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
): Promise<void> {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const { session_id } = req.query;
    if (typeof session_id !== 'string' || !session_id.trim()) {
        res.status(400).json({ error: 'session_id must be a non-empty string' });
        return;
    }

    try {
        const { session_id: _sid, ...rest } = req.query;
        const qs = new URLSearchParams(
            Object.fromEntries(
                Object.entries(rest).flatMap(([k, v]) =>
                    Array.isArray(v) ? v.map((val) => [k, val]) : [[k, v as string]]
                )
            )
        ).toString();
        const upstreamUrl = `${BACKEND_BASE_URL}/session/${encodeURIComponent(session_id)}${qs ? `?${qs}` : ''}`;
        const upstream = await fetch(upstreamUrl);

        if (!upstream.ok) {
            res.status(upstream.status).json({ error: GENERIC_ERROR });
            return;
        }

        const data = await upstream.json();
        res.status(200).json(data);
    } catch {
        res.status(502).json({ error: GENERIC_ERROR });
    }
}
