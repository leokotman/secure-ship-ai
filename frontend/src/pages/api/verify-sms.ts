import type { NextApiRequest, NextApiResponse } from "next";

interface VerifySmsBody {
  session_id?: unknown;
  code?: unknown;
}

const BACKEND_BASE_URL =
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

const GENERIC_ERROR =
  "Verification service is temporarily unavailable. Please try again.";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = req.body as VerifySmsBody;
  if (typeof body?.session_id !== "string" || !body.session_id.trim()) {
    res.status(400).json({ error: "session_id must be a non-empty string" });
    return;
  }
  if (typeof body?.code !== "string" || !/^\d{6}$/.test(body.code)) {
    res.status(400).json({ error: "code must be exactly 6 digits" });
    return;
  }

  try {
    const upstream = await fetch(`${BACKEND_BASE_URL}/verify-sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: body.session_id, code: body.code }),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      if (data && typeof data === "object") {
        res.status(upstream.status).json(data);
        return;
      }
      res.status(upstream.status).json({ error: GENERIC_ERROR });
      return;
    }

    res.status(200).json(data);
  } catch (error) {
    console.error("Failed to reach /verify-sms upstream", error);
    res.status(502).json({ error: GENERIC_ERROR });
  }
}
