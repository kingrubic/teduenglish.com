import { NextResponse } from "next/server";
import { api, convex } from "@/lib/convex";

export async function GET() {
  try {
    await convex().query(api.auth.ping, {});
    return NextResponse.json(
      { status: "ok", database: "connected", backend: "convex" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "error", database: "unavailable", backend: "convex" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
