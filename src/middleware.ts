import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { ADMIN_SESSION_COOKIE } from "@/lib/constants";

// Lightweight, edge-compatible first line of defense: redirects requests
// without a syntactically valid, correctly signed session cookie straight to
// /login. This does NOT replace the authoritative server-side check (which
// also re-validates the admin allowlist on every request) performed in
// src/app/(admin)/layout.tsx and in every API route via requireAuthorizedAdmin().
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/personality",
  "/ai-config",
  "/customization",
  "/users",
  "/usage",
  "/settings",
  "/audit-logs",
  "/integration",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!token || !secret) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return NextResponse.next();
  } catch {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    const response = NextResponse.redirect(url);
    response.cookies.set(ADMIN_SESSION_COOKIE, "", { maxAge: 0, path: "/" });
    return response;
  }
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/personality/:path*",
    "/ai-config/:path*",
    "/customization/:path*",
    "/users/:path*",
    "/usage/:path*",
    "/settings/:path*",
    "/audit-logs/:path*",
    "/integration/:path*",
  ],
};
