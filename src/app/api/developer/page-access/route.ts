import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/developer/page-access
 * Get all page access settings for the current developer
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check developer role
    if (session.user.role !== 'DEVELOPER') {
      return NextResponse.json(
        { error: 'Forbidden - Developer access required' },
        { status: 403 }
      );
    }

    const pageAccesses = await prisma.pageAccess.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        pagePath: 'asc',
      },
    });

    return NextResponse.json(pageAccesses);
  } catch (error) {
    console.error('Get page access error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch page access' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/developer/page-access
 * Create or update page access setting
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check developer role
    if (session.user.role !== 'DEVELOPER') {
      return NextResponse.json(
        { error: 'Forbidden - Developer access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { pagePath, isEnabled } = body;

    if (!pagePath || typeof pagePath !== 'string') {
      return NextResponse.json(
        { error: 'pagePath is required' },
        { status: 400 }
      );
    }

    if (typeof isEnabled !== 'boolean') {
      return NextResponse.json(
        { error: 'isEnabled must be a boolean' },
        { status: 400 }
      );
    }

    // Upsert page access
    const pageAccess = await prisma.pageAccess.upsert({
      where: {
        userId_pagePath: {
          userId: session.user.id,
          pagePath: pagePath,
        },
      },
      update: {
        isEnabled,
      },
      create: {
        userId: session.user.id,
        pagePath: pagePath,
        isEnabled,
      },
    });

    return NextResponse.json(pageAccess, { status: 201 });
  } catch (error) {
    console.error('Create/update page access error:', error);
    return NextResponse.json(
      { error: 'Failed to update page access' },
      { status: 500 }
    );
  }
}

