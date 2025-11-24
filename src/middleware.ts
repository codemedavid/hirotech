import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: DO NOT REMOVE auth.getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  console.log('[Middleware] 🔍 Request:', pathname, 'User:', user?.email || 'none');

  // Allow API routes to handle their own authentication
  if (pathname.startsWith('/api/')) {
    console.log('[Middleware] ✅ Allowing API route');
    return supabaseResponse;
  }

  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register');

  // Redirect logged-in users away from auth pages
  if (isAuthPage && user) {
    console.log('[Middleware] ↪️ Redirecting logged-in user to dashboard');
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // Redirect logged-out users to login
  if (!isAuthPage && !user) {
    console.log('[Middleware] ↪️ Redirecting logged-out user to login');
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Check developer page access
  if (user && !isAuthPage) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true },
      });

      // If user is a developer, check page access
      if (dbUser?.role === 'DEVELOPER') {
        try {
          const pageAccess = await prisma.pageAccess.findUnique({
            where: {
              userId_pagePath: {
                userId: user.id,
                pagePath: pathname,
              },
            },
          });

          // If page access is explicitly disabled, redirect to dashboard
          if (pageAccess && !pageAccess.isEnabled) {
            console.log('[Middleware] 🚫 Developer page access denied:', pathname);
            const url = request.nextUrl.clone();
            url.pathname = '/dashboard';
            return NextResponse.redirect(url);
          }
        } catch (pageAccessError) {
          // If PageAccess model doesn't exist or query fails, allow access
          console.warn('[Middleware] PageAccess check failed, allowing access:', pageAccessError);
        }
      }
    } catch (error) {
      // On error, allow access (fail open)
      console.error('[Middleware] Error checking developer access:', error);
    }
  }

  console.log('[Middleware] ✅ Allowing request');
  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (auth endpoints should not be protected by middleware)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

