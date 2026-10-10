import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL || "http://localhost:4173";
  return [{ url: `${base}/`, changeFrequency: "weekly", priority: 1 }];
}
