import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL || "http://localhost:4173";
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/bai/", "/thu-muc/", "/need-clarify"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
