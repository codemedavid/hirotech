import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { getUserPages, getPageAccessToken, getInstagramBusinessAccount } from '@/lib/facebook/auth';

interface SelectedPage {
  id: string;
  name: string;
}

/**
 * GET - Fetch user's Facebook pages
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const userAccessToken = searchParams.get('token');

    if (!userAccessToken) {
      return NextResponse.json(
        { error: 'Missing user access token' },
        { status: 400 }
      );
    }

    // Fetch user's Facebook pages
    const pages = await getUserPages(userAccessToken);

    // Check which pages are already connected
    const existingPages = await prisma.facebookPage.findMany({
      where: {
        organizationId: session.user.organizationId,
        pageId: { in: pages.map((p) => p.id) },
      },
      select: { pageId: true },
    });

    const existingPageIds = new Set(existingPages.map(p => p.pageId));

    // Mark pages as already connected
    const pagesWithStatus = pages.map((page) => ({
      id: page.id,
      name: page.name,
      accessToken: page.access_token,
      isConnected: existingPageIds.has(page.id),
    }));

    return NextResponse.json({ pages: pagesWithStatus });
  } catch (error: unknown) {
    console.error('Fetch pages error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch Facebook pages';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST - Save selected Facebook pages
 */
export async function POST(request: NextRequest) {
  console.log('=== FACEBOOK PAGES SAVE START ===');
  console.log('Timestamp:', new Date().toISOString());
  
  try {
    const session = await auth();
    console.log('Session check:', {
      authenticated: !!session?.user,
      userId: session?.user?.id,
      organizationId: session?.user?.organizationId,
    });
    
    if (!session?.user) {
      console.log('❌ Unauthorized - no session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as { selectedPages?: SelectedPage[]; userAccessToken?: string };
    const { selectedPages, userAccessToken } = body;
    
    console.log('Request body:', {
      pagesCount: selectedPages?.length || 0,
      hasToken: !!userAccessToken,
    });

    if (!selectedPages || !Array.isArray(selectedPages) || selectedPages.length === 0) {
      console.log('❌ No pages selected');
      return NextResponse.json(
        { error: 'No pages selected' },
        { status: 400 }
      );
    }

    if (!userAccessToken) {
      console.log('❌ Missing user access token');
      return NextResponse.json(
        { error: 'Missing user access token' },
        { status: 400 }
      );
    }

    interface SavedPage {
      id: string;
      pageId: string;
      pageName: string;
      instagramAccountId: string | null;
    }

    interface PageError {
      pageId: string;
      pageName: string;
      error: string;
    }

    const savedPages: SavedPage[] = [];
    const errors: PageError[] = [];

    console.log(`Processing ${selectedPages.length} page(s)...`);

    // Process each selected page
    for (const page of selectedPages) {
      console.log(`\n--- Processing page: ${page.name} (${page.id}) ---`);
      
      try {
        // Get page-specific access token
        console.log('Step 1: Getting page access token...');
        const { pageAccessToken, pageName } = await getPageAccessToken(
          userAccessToken,
          page.id
        );
        console.log('✓ Got page access token');

        // Check for Instagram business account
        console.log('Step 2: Checking Instagram business account...');
        const igAccount = await getInstagramBusinessAccount(pageAccessToken);
        console.log('✓ Instagram check complete:', igAccount ? `Found: ${igAccount.username}` : 'None');

        // Check if page already exists (globally first, then for this org)
        console.log('Step 3: Checking if page exists in database...');
        
        // First check if page exists anywhere in the database
        const globalExistingPage = await prisma.facebookPage.findUnique({
          where: {
            pageId: page.id,
          },
          select: {
            id: true,
            organizationId: true,
            pageName: true,
          },
        });

        if (globalExistingPage && globalExistingPage.organizationId !== session.user.organizationId) {
          // Page exists for a different organization
          console.log('⚠️  Page exists for different organization:', globalExistingPage.organizationId);
          throw new Error(
            `Page "${page.name}" is already connected to another organization. Please disconnect it from the other organization first, or contact support.`
          );
        }

        // Check if page exists for this organization
        const existingPage = globalExistingPage?.organizationId === session.user.organizationId 
          ? globalExistingPage 
          : null;
        
        console.log('✓ Database check:', existingPage ? `Existing page found (${existingPage.id})` : 'New page');

        if (existingPage) {
          // Update existing page
          console.log('Step 4: Updating existing page...');
          const updatedPage = await prisma.facebookPage.update({
            where: { id: existingPage.id },
            data: {
              pageName,
              pageAccessToken,
              instagramAccountId: igAccount?.id || null,
              instagramUsername: igAccount?.username || null,
              isActive: true,
              updatedAt: new Date(),
            },
          });
          console.log('✅ Page updated successfully:', updatedPage.id);
          savedPages.push(updatedPage);
        } else {
          // Create new page
          console.log('Step 4: Creating new page...');
          const newPage = await prisma.facebookPage.create({
            data: {
              pageId: page.id,
              pageName,
              pageAccessToken,
              instagramAccountId: igAccount?.id || null,
              instagramUsername: igAccount?.username || null,
              organizationId: session.user.organizationId,
            },
          });
          console.log('✅ Page created successfully:', newPage.id);
          savedPages.push(newPage);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Error processing page ${page.id}:`, errorMessage);
        console.error('Full error:', error);
        errors.push({
          pageId: page.id,
          pageName: page.name,
          error: errorMessage,
        });
      }
    }

    console.log('\n=== FACEBOOK PAGES SAVE COMPLETE ===');
    console.log('Summary:', {
      successful: savedPages.length,
      failed: errors.length,
      total: selectedPages.length,
    });

    const response = {
      success: true,
      savedPages: savedPages.length,
      errors: errors.length > 0 ? errors : undefined,
      pages: savedPages.map(p => ({
        id: p.id,
        pageId: p.pageId,
        name: p.pageName,
        hasInstagram: !!p.instagramAccountId,
      })),
    };
    
    console.log('Response:', response);
    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error('❌ CRITICAL: Save pages error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to save Facebook pages';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Error stack:', errorStack);
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Disconnect a Facebook page
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const pageId = searchParams.get('pageId');

    if (!pageId) {
      return NextResponse.json(
        { error: 'Missing page ID' },
        { status: 400 }
      );
    }

    // Delete the page (ensure it belongs to the user's organization)
    const deletedPage = await prisma.facebookPage.deleteMany({
      where: {
        id: pageId,
        organizationId: session.user.organizationId,
      },
    });

    if (deletedPage.count === 0) {
      return NextResponse.json(
        { error: 'Page not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Delete page error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to disconnect page';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

