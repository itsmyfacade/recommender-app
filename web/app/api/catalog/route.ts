import { NextResponse } from "next/server";

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001";
const REQUEST_TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS || "180000");

export async function GET() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_URL}/catalog`, { signal: controller.signal });
    const text = await response.text();
    return new NextResponse(text, { status: response.status, headers: { "Content-Type": "application/json" } });
  } catch {
    return NextResponse.json({ error: "Proxy failed to reach backend" }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
