/**
 * Proxy server-side para o gateway. O browser sempre chama /api/gw/*
 * (mesma origem — sem CORS, sem SSL, sem NEXT_PUBLIC_GATEWAY_URL).
 * O Next.js server repassa para GATEWAY_URL (variável interna do container).
 */
import { NextRequest } from "next/server";

const GATEWAY = (process.env.GATEWAY_URL || "http://localhost:8000").replace(/\/$/, "");

function upstream(segments: string[]): string {
  return `${GATEWAY}/${segments.join("/")}`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const res = await fetch(upstream(params.path));
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") || "application/json" },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const body = await req.text();
  const res = await fetch(upstream(params.path), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  const ct = res.headers.get("content-type") || "application/json";
  return new Response(res.body, {
    status: res.status,
    headers: {
      "content-type": ct,
      ...(ct.includes("event-stream") ? { "cache-control": "no-cache", "x-accel-buffering": "no" } : {}),
    },
  });
}
