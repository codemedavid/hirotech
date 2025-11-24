/**
 * Convert an existing user to DEVELOPER role
 * Usage: npx tsx scripts/create-developer-user.ts [email]
 * 
 * Example: npx tsx scripts/create-developer-user.ts admin@admin.com
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function createDeveloperUser() {
  try {
    const email = process.argv[2] || 'admin@admin.com'; // Default to common test account
    
    console.log('🚀 Converting user to DEVELOPER role...\n');
    console.log(`📧 Looking for user: ${email}\n`);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (!existingUser) {
      console.log('❌ User not found in database!');
      console.log('\n💡 Available options:');
      console.log('1. Register a new user at /register, then run this script again');
      console.log('2. Check existing users with: npx prisma studio');
      console.log('3. Use a different email: npx tsx scripts/create-developer-user.ts your@email.com\n');
      return;
    }

    // Update to developer if not already
    if (existingUser.role === 'DEVELOPER') {
      console.log('✅ User is already a DEVELOPER!\n');
    } else {
      await prisma.user.update({
        where: { email },
        data: { role: 'DEVELOPER' },
      });
      console.log(`✅ Updated user "${email}" to DEVELOPER role!\n`);
    }

    // Get updated user info
    const updatedUser = await prisma.user.findUnique({
      where: { email },
      include: { organization: true },
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 DEVELOPER ACCOUNT INFO');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email:          ${updatedUser!.email}`);
    console.log(`Name:           ${updatedUser!.name || 'N/A'}`);
    console.log(`Role:           ${updatedUser!.role}`);
    console.log(`User ID:        ${updatedUser!.id}`);
    console.log(`Organization:   ${updatedUser!.organization.name}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('⚠️  NOTE: Password is managed by Supabase Auth');
    console.log('   Use your existing login credentials to sign in.\n');
    console.log('🎯 Next Steps:');
    console.log('1. Login at: http://localhost:3000/login');
    console.log('2. Go to: /settings/developer (to manage page access)');
    console.log('3. Go to: /settings/api-keys (to manage API keys)\n');
  } catch (error) {
    console.error('❌ Error creating developer account:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createDeveloperUser();

