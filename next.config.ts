import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(process.cwd()),
  poweredByHeader: false,
  agentRules: false,
  allowedDevOrigins: ["teduenglish.com", "www.teduenglish.com"],
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
  async headers() {
    const isDev = process.env.NODE_ENV !== "production";
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com"
      : "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com";
    return [{ source: "/(.*)", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
      ,{ key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
      ,{ key: "Content-Security-Policy", value: `default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; ${scriptSrc}; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' http://127.0.0.1:* ws: wss: https://static.cloudflareinsights.com https://*.convex.cloud https://*.convex.site; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` }
    ] }];
  }
};

export default nextConfig;
