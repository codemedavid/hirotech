import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, image } = body;

    // Prepare update data
    const updateData: { name?: string; image?: string } = {};
    
    if (name !== undefined) {
      updateData.name = name;
    }
    
    if (image !== undefined) {
      updateData.image = image;
    }

    // Update user in database
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
      },
    });

    // Also update Supabase user metadata so the header updates immediately
    try {
      const supabase = await createClient();
      await supabase.auth.updateUser({
        data: {
          name: updatedUser.name,
          image: updatedUser.image,
        },
      });
    } catch (supabaseError) {
      console.error('Supabase metadata update error:', supabaseError);
      // Continue even if Supabase update fails - database is source of truth
    }

    return NextResponse.json({
      user: updatedUser,
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}

