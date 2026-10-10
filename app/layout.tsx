import type { Metadata, Viewport } from "next";
import ConvexClientProvider from "./providers";
import "./site.css";
import "./admin.css";
import "./reader.css";

const description =
  "Góc luyện tập tiếng Anh dành cho học sinh TEDU English: bài trắc nghiệm, điền từ, nghe, đọc và tài liệu được giao theo mã cá nhân.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:4173"),
  title: "TEDU English",
  description,
  icons: { icon: "/favicon.png" },
  openGraph: {
    title: "TEDU English · Better English, Brighter Futures",
    description,
    siteName: "TEDU English",
    locale: "vi_VN",
    type: "website",
    images: ["/tedu-logo.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The splash script toggles a class on <html> before hydration.
    <html lang="vi" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
