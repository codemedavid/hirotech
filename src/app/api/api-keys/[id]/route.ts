import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { ApiKeyStatus } from '@prisma/client';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/api-keys/[id]
 * Update an API key (name, status) (admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, status } = body;

    // Validate status if provided
    if (status && !Object.values(ApiKeyStatus).includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${Object.values(ApiKeyStatus).join(', ')}` },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name || null;
    if (status !== undefined) {
      updateData.status = status;
      // If setting to ACTIVE from RATE_LIMITED, clear rateLimitedAt
      if (status === ApiKeyStatus.ACTIVE) {
        updateData.rateLimitedAt = null;
      }
    }

    // Update the key
    const apiKey = await prisma.apiKey.update({
      where: { id },
      data: updateData,
    });

    // Return safe version
    return NextResponse.json({
      id: apiKey.id,
      name: apiKey.name,
      status: apiKey.status,
      rateLimitedAt: apiKey.rateLimitedAt,
      updatedAt: apiKey.updatedAt,
    });
  } catch (error) {
    console.error('Update API key error:', error);
    
    // Check if key not found
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update API key' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/api-keys/[id]
 * Soft delete an API key (mark as DISABLED) (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { id } = await params;

    // Soft delete by marking as DISABLED
    const apiKey = await prisma.apiKey.update({
      where: { id },
      data: {
        status: ApiKeyStatus.DISABLED,
      },
    });

    return NextResponse.json({
      id: apiKey.id,
      status: apiKey.status,
      message: 'API key disabled successfully',
    });
  } catch (error) {
    console.error('Delete API key error:', error);
    
    // Check if key not found
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to delete API key' },
      { status: 500 }
    );
  }
}

