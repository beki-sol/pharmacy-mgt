/*
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
}; */
import { withAuth, NextRequestWithAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/**
 * Check if the license has expired by calling the internal API.
 * Returns true if expired, false otherwise.
 */
async function isLicenseExpired(request: NextRequestWithAuth): Promise<boolean> {
  try {
    const licenseUrl = new URL("/api/license", request.url);
    const res = await fetch(licenseUrl.toString());
    const { isExpired } = await res.json();
    return isExpired;
  } catch (error) {
    console.error("License check failed:", error);
    return true; // fail secure – treat as expired
  }
}

export default withAuth(
  async function middleware(req: NextRequestWithAuth) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // ---- Paths that are always allowed (no license check, no auth) ----
    const publicPaths = ["/api/license", "/api/admin/reset-trial", "/payment"];
    if (publicPaths.some(p => pathname === p || pathname.startsWith(p))) {
      return NextResponse.next();
    }

    const isAuthPage = pathname.startsWith("/auth");
    const isDashboardPage = pathname.startsWith("/dashboard");
    const isApiRoute = pathname.startsWith("/api");

    // 1. Redirect logged‑in users away from auth pages
    if (token && isAuthPage) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // 2. Redirect unauthenticated users from protected routes to login
    if (!token && (isDashboardPage || isApiRoute)) {
      const loginUrl = new URL("/auth/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // 3. License check for authenticated users on protected routes
    if (token && (isDashboardPage || isApiRoute)) {
      const expired = await isLicenseExpired(req);
      if (expired) {
        return NextResponse.redirect(new URL("/payment", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;
        // Allow public paths, auth pages, and the reset endpoint without a token
        const publicPaths = ["/api/license", "/api/admin/reset-trial", "/payment", "/auth"];
        if (publicPaths.some(p => pathname.startsWith(p))) {
          return true;
        }
        // For everything else, require a valid token
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/:path*",
    "/auth/:path*",
  ],
};