import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

/**
 * Diagnostic endpoint to check Facebook integration setup
 * Access: /api/facebook/debug
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    // Check 1: Authentication
    const authStatus = {
      authenticated: !!session?.user,
      userId: session?.user?.id || null,
      organizationId: session?.user?.organizationId || null,
    };

    // Check 2: Environment Variables
    const envStatus = {
      NEXT_PUBLIC_APP_URL: {
        set: !!process.env.NEXT_PUBLIC_APP_URL,
        value: process.env.NEXT_PUBLIC_APP_URL || 'NOT SET',
        valid: process.env.NEXT_PUBLIC_APP_URL?.startsWith('http'),
        isLocalhost: process.env.NEXT_PUBLIC_APP_URL?.includes('localhost'),
      },
      FACEBOOK_APP_ID: {
        set: !!process.env.FACEBOOK_APP_ID,
        length: process.env.FACEBOOK_APP_ID?.length || 0,
      },
      FACEBOOK_APP_SECRET: {
        set: !!process.env.FACEBOOK_APP_SECRET,
        length: process.env.FACEBOOK_APP_SECRET?.length || 0,
      },
      FACEBOOK_WEBHOOK_VERIFY_TOKEN: {
        set: !!process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN,
      },
      DATABASE_URL: {
        set: !!process.env.DATABASE_URL,
        valid: process.env.DATABASE_URL?.startsWith('postgresql://') || process.env.DATABASE_URL?.startsWith('postgres://'),
      },
    };

    // Check 3: Database Connection
    const dbStatus = {
      connected: false,
      error: null as string | null,
      facebookPagesCount: 0,
    };

    try {
      await prisma.$connect();
      dbStatus.connected = true;

      if (session?.user?.organizationId) {
        const count = await prisma.facebookPage.count({
          where: {
            organizationId: session.user.organizationId,
          },
        });
        dbStatus.facebookPagesCount = count;
      }
    } catch (error: unknown) {
      dbStatus.error = error instanceof Error ? error.message : 'Unknown database error';
    } finally {
      await prisma.$disconnect();
    }

    // Check 4: Calculated URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const calculatedUrls = {
      oauthCallback: `${baseUrl}/api/facebook/callback`,
      oauthCallbackPopup: `${baseUrl}/api/facebook/callback-popup`,
      webhook: `${baseUrl}/api/webhooks/facebook`,
    };

    // Check 5: Recent Facebook Pages (if authenticated)
    let recentPages: Array<{
      id: string;
      pageId: string;
      pageName: string;
      isActive: boolean;
      hasInstagram: boolean;
      createdAt: Date;
      updatedAt: Date;
    }> = [];

    if (session?.user?.organizationId && dbStatus.connected) {
      try {
        const pages = await prisma.facebookPage.findMany({
          where: {
            organizationId: session.user.organizationId,
          },
          select: {
            id: true,
            pageId: true,
            pageName: true,
            isActive: true,
            instagramAccountId: true,
            instagramUsername: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 5,
        });

        recentPages = pages.map(p => ({
          id: p.id,
          pageId: p.pageId,
          pageName: p.pageName,
          isActive: p.isActive,
          hasInstagram: !!p.instagramAccountId,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        }));
      } catch (error) {
        console.error('Error fetching recent pages:', error);
      }
    }

    // Overall Status
    const criticalIssues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    if (!envStatus.FACEBOOK_APP_ID.set) {
      criticalIssues.push('FACEBOOK_APP_ID not set in environment variables');
    }
    if (!envStatus.FACEBOOK_APP_SECRET.set) {
      criticalIssues.push('FACEBOOK_APP_SECRET not set in environment variables');
    }
    if (!envStatus.NEXT_PUBLIC_APP_URL.set) {
      criticalIssues.push('NEXT_PUBLIC_APP_URL not set in environment variables');
    }
    if (!envStatus.DATABASE_URL.set) {
      criticalIssues.push('DATABASE_URL not set in environment variables');
    }
    if (!dbStatus.connected) {
      criticalIssues.push(`Database connection failed: ${dbStatus.error}`);
    }

    if (envStatus.NEXT_PUBLIC_APP_URL.isLocalhost) {
      warnings.push('Using localhost URL - Facebook OAuth requires a public URL for production');
      recommendations.push('Use ngrok or similar tunneling service for local development');
    }

    if (dbStatus.connected && dbStatus.facebookPagesCount === 0 && session?.user) {
      warnings.push('No Facebook pages connected yet');
      recommendations.push('Connect at least one Facebook page to start using the platform');
    }

    if (!envStatus.FACEBOOK_WEBHOOK_VERIFY_TOKEN.set) {
      warnings.push('FACEBOOK_WEBHOOK_VERIFY_TOKEN not set - webhooks will not work');
    }

    const overallStatus = {
      healthy: criticalIssues.length === 0,
      readyForFacebookOAuth: criticalIssues.length === 0,
      criticalIssues,
      warnings,
      recommendations,
    };

    // Return comprehensive diagnostic report
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      overallStatus,
      authentication: authStatus,
      environment: envStatus,
      database: dbStatus,
      urls: calculatedUrls,
      connectedPages: {
        count: dbStatus.facebookPagesCount,
        recent: recentPages,
      },
      nextSteps: criticalIssues.length > 0 
        ? ['Fix critical issues listed above before attempting to connect Facebook']
        : warnings.length > 0
        ? ['Review warnings and recommendations', 'Test Facebook connection']
        : ['System is healthy', 'Ready to connect Facebook pages'],
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('Diagnostic endpoint error:', error);
    return NextResponse.json({
      error: 'Diagnostic check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}

