import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(process.cwd()),
  poweredByHeader: false,
  agentRules: false,
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
  async headers() {
    const isDev = process.env.NODE_ENV !== "production";
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'";
    return [{ source: "/(.*)", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
      ,{ key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
      ,{ key: "Content-Security-Policy", value: `default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; ${scriptSrc}; font-src 'self' data:; connect-src 'self' http://127.0.0.1:* https://*.convex.cloud https://*.convex.site; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` }
    ] }];
  }
};

export default nextConfig;
