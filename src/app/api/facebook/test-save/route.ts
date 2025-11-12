import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

/**
 * Test endpoint to verify database save functionality
 * This helps diagnose if the issue is with saving to the database
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.organizationId) {
      return NextResponse.json({ 
        error: 'Unauthorized',
        authenticated: !!session?.user,
        hasOrganizationId: !!session?.user?.organizationId,
      }, { status: 401 });
    }

    const body = await request.json();
    const { testMode } = body;

    // Test mode: Create a test Facebook page entry
    if (testMode === 'create') {
      const testPageId = `test_${Date.now()}`;
      
      try {
        const testPage = await prisma.facebookPage.create({
          data: {
            pageId: testPageId,
            pageName: 'Test Page (Delete Me)',
            pageAccessToken: 'test_token_12345',
            organizationId: session.user.organizationId,
            instagramAccountId: null,
            instagramUsername: null,
          },
        });

        return NextResponse.json({
          success: true,
          message: 'Test page created successfully',
          testPage: {
            id: testPage.id,
            pageId: testPage.pageId,
            pageName: testPage.pageName,
            createdAt: testPage.createdAt,
          },
          note: 'This is a test entry. You can delete it from the database.',
        });
      } catch (dbError: unknown) {
        return NextResponse.json({
          success: false,
          error: 'Database save failed',
          message: dbError instanceof Error ? dbError.message : 'Unknown error',
          details: {
            name: dbError instanceof Error ? dbError.name : 'Unknown',
            stack: dbError instanceof Error ? dbError.stack : undefined,
          },
        }, { status: 500 });
      }
    }

    // Test mode: Check existing pages
    if (testMode === 'check') {
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
            createdAt: true,
            updatedAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        return NextResponse.json({
          success: true,
          pagesCount: pages.length,
          pages: pages.map(p => ({
            id: p.id,
            pageId: p.pageId,
            pageName: p.pageName,
            isActive: p.isActive,
            hasInstagram: !!p.instagramAccountId,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
          })),
        });
      } catch (dbError: unknown) {
        return NextResponse.json({
          success: false,
          error: 'Database query failed',
          message: dbError instanceof Error ? dbError.message : 'Unknown error',
        }, { status: 500 });
      }
    }

    // Test mode: Delete test pages
    if (testMode === 'cleanup') {
      try {
        const deleted = await prisma.facebookPage.deleteMany({
          where: {
            organizationId: session.user.organizationId,
            pageId: {
              startsWith: 'test_',
            },
          },
        });

        return NextResponse.json({
          success: true,
          message: `Deleted ${deleted.count} test page(s)`,
          deletedCount: deleted.count,
        });
      } catch (dbError: unknown) {
        return NextResponse.json({
          success: false,
          error: 'Database delete failed',
          message: dbError instanceof Error ? dbError.message : 'Unknown error',
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      error: 'Invalid test mode',
      validModes: ['create', 'check', 'cleanup'],
    }, { status: 400 });

  } catch (error: unknown) {
    console.error('Test save endpoint error:', error);
    return NextResponse.json({
      error: 'Test endpoint failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

