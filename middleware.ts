import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const isAuthPage = req.nextUrl.pathname.startsWith("/auth");
    const isDashboardPage = req.nextUrl.pathname.startsWith("/dashboard");

    // If logged in and trying to access auth page, redirect to dashboard
    if (token && isAuthPage) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // If not logged in and trying to access dashboard, redirect to login
    if (!token && isDashboardPage) {
      const loginUrl = new URL("/auth/login", req.url);
      loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow access to auth pages even without token
        if (req.nextUrl.pathname.startsWith("/auth")) {
          return true;
        }
        // For dashboard and API routes, require token
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/auth/:path*",
    "/api/:path*", // optional – protect API routes if desired
  ],
};