import { NextResponse } from "next/server";
import { sessionHash } from "@/lib/auth";
import { api, convex } from "@/lib/convex";
import type { Id } from "@/convex/_generated/dataModel";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const tokenHash = await sessionHash();
  if (!tokenHash)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const item = await convex().query(api.cms.resourceDownload, {
    tokenHash,
    id: id as Id<"resources">,
  });
  if (!item) return NextResponse.json({ error: "File not found" }, { status: 404 });
  const file = await fetch(item.url);
  if (!file.ok)
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  return new NextResponse(file.body, {
    headers: {
      "Content-Type": item.mime_type,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(item.original_name || "tai-lieu")}`,
      "Cache-Control": "private, no-store",
    },
  });
}
