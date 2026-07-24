import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

// Optimistic redirect only — the cookie is not validated here. Every
// protected page and server action re-checks the session server-side.
export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const signIn = new URL('/sign-in', request.url);
    signIn.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(signIn);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/tokens/:path*'],
};
