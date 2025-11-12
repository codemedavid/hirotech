/**
 * Sync Supabase users to database
 * 
 * This script checks all users in Supabase Auth and ensures they have
 * corresponding profiles in the database. If a user doesn't have a profile,
 * it creates one automatically.
 * 
 * Usage: npx tsx scripts/sync-supabase-users.ts
 */

import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Starting Supabase user sync...\n');

  // Create Supabase admin client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing required environment variables:');
    console.error('   - NEXT_PUBLIC_SUPABASE_URL');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Get all users from Supabase Auth
    console.log('📋 Fetching users from Supabase Auth...');
    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    if (error) {
      throw error;
    }

    console.log(`✅ Found ${users.length} users in Supabase Auth\n`);

    let synced = 0;
    let skipped = 0;
    let failed = 0;

    for (const user of users) {
      try {
        console.log(`\n🔍 Checking user: ${user.email} (${user.id})`);

        // Check if user exists in database
        const existingProfile = await prisma.user.findUnique({
          where: { id: user.id },
        });

        if (existingProfile) {
          console.log(`   ✅ Profile already exists - skipping`);
          skipped++;
          continue;
        }

        // Create profile for user
        console.log(`   📝 Creating profile...`);

        const name = user.user_metadata?.name || user.email?.split('@')[0] || 'User';
        const organizationName = user.user_metadata?.organization_name || `${name}'s Organization`;

        // Create organization slug
        const baseSlug = organizationName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');

        // Find available slug
        let slug = baseSlug;
        let counter = 1;
        while (await prisma.organization.findUnique({ where: { slug } })) {
          slug = `${baseSlug}-${counter}`;
          counter++;
        }

        // Create organization and user profile
        await prisma.$transaction(async (tx) => {
          const organization = await tx.organization.create({
            data: {
              name: organizationName,
              slug,
            },
          });

          await tx.user.create({
            data: {
              id: user.id,
              email: user.email!,
              name,
              password: null, // Password managed by Supabase
              role: 'ADMIN',
              organizationId: organization.id,
            },
          });
        });

        console.log(`   ✅ Profile created successfully`);
        synced++;
      } catch (userError) {
        console.error(`   ❌ Failed to sync user ${user.email}:`, userError);
        failed++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Sync Summary:');
    console.log('='.repeat(60));
    console.log(`Total users:        ${users.length}`);
    console.log(`Synced:            ${synced}`);
    console.log(`Already existed:   ${skipped}`);
    console.log(`Failed:            ${failed}`);
    console.log('='.repeat(60));
    console.log('\n✅ Sync completed!\n');
  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

