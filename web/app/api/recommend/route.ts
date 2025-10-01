import { NextResponse } from "next/server";

/*
  This route forwards POST /api/recommend to the Flask backend.
  - Keeps browser requests same-origin during dev.
  - Uses NEXT_PUBLIC_API_URL to know where the backend lives.
*/

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001";

export async function POST(req: Request) {
  try {
    // read the raw JSON body from the browser request
    const body = await req.text();

    // forward the request to Flask /recommend
    const r = await fetch(`${API_URL}/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    });

    // return Flask's response to the browser unchanged
    const text = await r.text();
    return new NextResponse(text, {
      status: r.status,
      headers: { "Content-Type": "application/json" }
    });
  } catch {
    // if backend is down or URL is wrong, return a 502 error
    return NextResponse.json({ error: "Proxy failed to reach backend" }, { status: 502 });
  }
}