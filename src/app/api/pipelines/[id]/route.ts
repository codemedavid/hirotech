import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const pipeline = await prisma.pipeline.findFirst({
      where: {
        id: id,
        organizationId: session.user.organizationId,
      },
      include: {
        stages: {
          orderBy: { order: 'asc' },
          include: {
            contacts: {
              where: search
                ? {
                    OR: [
                      { firstName: { contains: search, mode: 'insensitive' } },
                      { lastName: { contains: search, mode: 'insensitive' } },
                    ],
                  }
                : undefined,
              take: limit,
              skip: (page - 1) * limit,
              orderBy: { stageEnteredAt: 'desc' },
            },
            _count: {
              select: { contacts: true },
            },
          },
        },
      },
    });

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }

    return NextResponse.json(pipeline);
  } catch (error: unknown) {
    console.error('Get pipeline error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch pipeline';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as {
      name?: string;
      description?: string;
      color?: string;
    };

    const pipeline = await prisma.pipeline.update({
      where: { 
        id: id,
        organizationId: session.user.organizationId,
      },
      data: {
        name: body.name,
        description: body.description,
        color: body.color,
      },
      include: {
        stages: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return NextResponse.json(pipeline);
  } catch (error: unknown) {
    console.error('Update pipeline error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update pipeline';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.pipeline.delete({
      where: { 
        id: id,
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Delete pipeline error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete pipeline';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
