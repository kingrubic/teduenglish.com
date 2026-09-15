import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PROTECTED = ["/hoc-tap", "/cms", "/tai-khoan"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  if (!needsAuth) return NextResponse.next();
  if (request.cookies.get("elh_session")?.value) return NextResponse.next();
  const login = request.nextUrl.clone();
  login.pathname = "/dang-nhap";
  login.search = "";
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/hoc-tap", "/hoc-tap/:path*", "/cms", "/cms/:path*", "/tai-khoan"],
};
