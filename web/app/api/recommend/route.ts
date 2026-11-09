import { NextResponse } from "next/server";

/*
  This route forwards POST /api/recommend to the Flask backend.
  - Keeps browser requests same-origin during dev.
  - Uses NEXT_PUBLIC_API_URL to know where the backend lives.
*/

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001";
const REQUEST_TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS || "180000");

export async function POST(req: Request) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    // read the raw JSON body from the browser request
    const body = await req.text();

    // forward the request to Flask /recommend
    const r = await fetch(`${API_URL}/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal,
    });

    // return Flask's response to the browser unchanged
    const text = await r.text();
    return new NextResponse(text, {
      status: r.status,
      headers: { "Content-Type": "application/json" }
    });
  } catch {
    return NextResponse.json({ error: "Proxy failed to reach backend" }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
