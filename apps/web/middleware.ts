import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define routes that should be publicly accessible
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)", // Matches /sign-in and /sign-in/*
  "/sign-up(.*)", // Matches /sign-up and /sign-up/*
  "/api/webhooks/(.*)", // Example for webhook endpoints
  "/landing", // Landing page for non-authenticated users
  "/about",
  "/pricing",
  // Add any other public routes here
]);

export default clerkMiddleware(async (auth, req) => {
  // Middleware running for every matched route.
  console.log("Middleware running for:", req.url);

  if (req.url.includes("/api")) {
    return NextResponse.next();
  }

  const { userId } = await auth();
  const url = new URL(req.url);

  // Handle the root route based on authentication status
  if (url.pathname === "/") {
    // If user is not logged in and trying to access the root, redirect to landing
    if (!userId) {
      return NextResponse.redirect(new URL("/landing", url.origin));
    }
    // If user is logged in, they can access the PDF list at root
    return NextResponse.next();
  }

  // If user is logged in and trying to access landing page, redirect to root (PDF list)
  if (userId && url.pathname === "/landing") {
    return NextResponse.redirect(new URL("/", url.origin));
  }

  // For other public routes, allow access without authentication
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // For all other protected routes, check if user is authenticated
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", url.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next/static|_next/image|favicon.ico|.*.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    // Match all routes, including API routes (except those excluded above)
    "/",
    "/(api|trpc)(.*)",
  ],
};
