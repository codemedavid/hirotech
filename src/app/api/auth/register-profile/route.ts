import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    console.log('[Register Profile] === Starting Profile Creation ===');
    
    const body = await request.json();
    const { userId, name, email, organizationName } = body;

    console.log('[Register Profile] Received data:', {
      userId,
      name,
      email,
      organizationName,
    });

    // Validate required fields
    if (!userId || !name || !email || !organizationName) {
      console.error('[Register Profile] ❌ Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Test database connection
    try {
      await prisma.$connect();
      console.log('[Register Profile] ✅ Database connected');
    } catch (dbError) {
      console.error('[Register Profile] ❌ Database connection failed:', dbError);
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      );
    }

    // Check if user already exists in our database
    console.log('[Register Profile] 🔍 Checking for existing user...');
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (existingUser) {
      console.log('[Register Profile] ✅ User profile already exists');
      return NextResponse.json(
        {
          success: true,
          user: {
            id: existingUser.id,
            name: existingUser.name,
            email: existingUser.email,
            organizationId: existingUser.organizationId,
          },
        },
        { status: 200 }
      );
    }

    // Create organization slug from name
    const slug = organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Check if organization slug exists
    let finalSlug = slug;
    let counter = 1;
    console.log('[Register Profile] 🔍 Checking organization slug availability...');
    while (await prisma.organization.findUnique({ where: { slug: finalSlug } })) {
      finalSlug = `${slug}-${counter}`;
      counter++;
    }
    console.log('[Register Profile] ✅ Organization slug:', finalSlug);

    // Create organization and user in a transaction
    console.log('[Register Profile] 📝 Creating organization and user profile...');
    const user = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: organizationName,
          slug: finalSlug,
        },
      });

      console.log('[Register Profile] ✅ Organization created:', organization.id);

      return await tx.user.create({
        data: {
          id: userId, // Use Supabase user ID
          name,
          email,
          password: null, // No password stored in our DB - managed by Supabase
          role: 'ADMIN',
          organizationId: organization.id,
        },
      });
    });

    console.log('[Register Profile] ✅ User profile created:', user.id);
    console.log('[Register Profile] 🎉 Profile creation successful!');

    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Register Profile] 💥 Exception:', error);
    return NextResponse.json(
      { 
        error: 'An error occurred during profile creation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

