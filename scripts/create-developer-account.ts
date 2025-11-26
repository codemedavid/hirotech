/**
 * Create a developer account with Supabase Auth
 * Usage: npx tsx scripts/create-developer-account.ts
 */
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

// Supabase Admin Client (requires service role key)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials!');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function createDeveloperAccount() {
  try {
    const email = 'hirotech.developer@gmail.com';
    const password = 'demet5732595';
    const name = 'Hiro Tech Developer';

    console.log('🚀 Creating developer account...\n');
    console.log(`📧 Email: ${email}`);
    console.log(`👤 Name: ${name}\n`);

    // Check if user already exists in database
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.log('✅ User already exists in database!');
      
      // Update to developer role
      if (existingUser.role !== 'DEVELOPER') {
        await prisma.user.update({
          where: { email },
          data: { role: 'DEVELOPER' },
        });
        console.log('✅ Updated role to DEVELOPER!\n');
      } else {
        console.log('✅ User is already a DEVELOPER!\n');
      }

      const user = await prisma.user.findUnique({
        where: { email },
        include: { organization: true },
      });

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📧 DEVELOPER ACCOUNT CREDENTIALS');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`Email:          ${user!.email}`);
      console.log(`Password:       ${password}`);
      console.log(`Name:           ${user!.name || name}`);
      console.log(`Role:           ${user!.role}`);
      console.log(`User ID:        ${user!.id}`);
      console.log(`Organization:   ${user!.organization.name}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return;
    }

    // Check if user exists in Supabase Auth
    console.log('🔍 Checking Supabase Auth...');
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error checking Supabase users:', listError);
      throw listError;
    }

    const supabaseUser = users.find(u => u.email === email);

    let userId: string;

    if (supabaseUser) {
      console.log('✅ User exists in Supabase Auth');
      userId = supabaseUser.id;
      
      // Update password if needed
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password: password }
      );
      
      if (updateError) {
        console.warn('⚠️  Could not update password:', updateError.message);
      } else {
        console.log('✅ Password updated');
      }
    } else {
      // Create user in Supabase Auth
      console.log('📝 Creating user in Supabase Auth...');
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          name,
        },
      });

      if (createError) {
        console.error('❌ Error creating user in Supabase:', createError);
        throw createError;
      }

      userId = newUser.user.id;
      console.log('✅ User created in Supabase Auth');
    }

    // Check if organization exists
    let organization = await prisma.organization.findFirst();

    if (!organization) {
      console.log('📦 Creating organization...');
      organization = await prisma.organization.create({
        data: {
          name: 'Hiro Tech',
          slug: 'hiro-tech',
        },
      });
      console.log('✅ Organization created');
    } else {
      console.log('✅ Using existing organization:', organization.name);
    }

    // Create user profile in database
    console.log('👤 Creating user profile in database...');
    const user = await prisma.user.create({
      data: {
        id: userId,
        email,
        name,
        password: null, // Password managed by Supabase
        role: 'DEVELOPER',
        organizationId: organization.id,
      },
      include: {
        organization: true,
      },
    });

    console.log('\n✅ Developer account created successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 DEVELOPER ACCOUNT CREDENTIALS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email:          ${email}`);
    console.log(`Password:       ${password}`);
    console.log(`Name:           ${name}`);
    console.log(`Role:           DEVELOPER`);
    console.log(`User ID:        ${userId}`);
    console.log(`Organization:   ${organization.name}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🎯 Next Steps:');
    console.log('1. Login at: http://localhost:3000/login');
    console.log('2. Go to: /settings/developer (to manage page access)');
    console.log('3. Go to: /settings/api-keys (to manage API keys)\n');
  } catch (error) {
    console.error('❌ Error creating developer account:', error);
    if (error instanceof Error) {
      console.error('Details:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

createDeveloperAccount();

