/**
 * ⚠️ SECURITY WARNING ⚠️
 * 
 * This endpoint is implemented at user's explicit request despite security warnings.
 * 
 * RISKS:
 * - Does NOT return actual password (impossible - it's hashed)
 * - Returns a hint that password exists
 * - This is still a security concern
 * 
 * RECOMMENDATION: Remove this endpoint and use secure alternatives:
 * - Extended session duration
 * - Biometric authentication
 * - Email verification
 * - Two-factor authentication
 * 
 * Created: November 12, 2025
 * Status: HIGH SECURITY RISK
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  console.warn('⚠️ SECURITY: Password hint endpoint called - This is a security risk!');
  
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user to check if they have a password
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        id: true, 
        password: true,
        email: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // We CANNOT return the actual password (it's hashed)
    // Instead, we return metadata about password existence
    return NextResponse.json({
      hasPassword: !!user.password,
      isOAuthAccount: !user.password,
      // ⚠️ Security note: We never return the actual password
      securityWarning: 'Password cannot be auto-filled for security reasons',
      recommendation: 'Use password manager or biometric authentication'
    });
  } catch (error) {
    console.error('Password hint error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch password hint' },
      { status: 500 }
    );
  }
}

