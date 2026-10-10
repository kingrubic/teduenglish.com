import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  try {
    if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
    const home = await new ConvexHttpClient(url).query(api.site.home, {});
    return Response.json({ status: "ok", backend: "convex", folders: home.folders.length });
  } catch {
    return Response.json({ status: "error", backend: "convex" }, { status: 503 });
  }
}
