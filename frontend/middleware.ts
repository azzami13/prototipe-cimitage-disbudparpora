import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { canAccessPath } from "./lib/rbac";

export default async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/admin/unauthorized") {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/driver")) {
    if (token.role !== "driver") {
      return NextResponse.redirect(new URL(token.role === "super_admin" || token.role === "admin_operasional" ? "/admin" : token.role === "tour_guide" ? "/guide" : "/", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/guide")) {
    if (token.role !== "tour_guide") {
      return NextResponse.redirect(new URL(token.role === "driver" ? "/driver" : token.role === "super_admin" || token.role === "admin_operasional" ? "/admin" : "/", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin") && (token.role === "driver" || token.role === "tour_guide")) {
    return NextResponse.redirect(new URL(token.role === "driver" ? "/driver" : "/guide", request.url));
  }

  if (!canAccessPath(token.role, pathname)) {
    return NextResponse.redirect(new URL("/admin/unauthorized", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/driver/:path*", "/guide/:path*"],
};
