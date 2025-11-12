'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      console.log('[Register] === Starting Supabase Registration ===');
      console.log('[Register] Email:', email);
      console.log('[Register] Name:', name);
      console.log('[Register] Organization:', organizationName);

      const supabase = createClient();

      // Step 1: Register user with Supabase Auth
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            organization_name: organizationName,
          },
        },
      });

      console.log('[Register] Supabase signup response:', {
        hasUser: !!authData?.user,
        hasSession: !!authData?.session,
        error: signUpError?.message,
      });

      if (signUpError) {
        console.error('[Register] ❌ Signup error:', signUpError);
        
        if (signUpError.message.includes('already registered')) {
          setError('This email is already registered. Please login instead.');
        } else {
          setError(signUpError.message);
        }
        
        setIsLoading(false);
        return;
      }

      if (!authData?.user) {
        console.error('[Register] ❌ No user returned');
        setError('Registration failed. Please try again.');
        setIsLoading(false);
        return;
      }

      console.log('[Register] ✅ User created in Supabase:', authData.user.id);

      // Step 2: Create organization and user profile in our database
      const response = await fetch('/api/auth/register-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: authData.user.id,
          name,
          email,
          organizationName,
        }),
      });

      const profileData = await response.json();

      if (!response.ok) {
        console.error('[Register] ❌ Profile creation failed:', profileData.error);
        // User is created in Supabase but profile failed
        // They can still login but might have issues
        setError('Account created but profile setup failed. Please contact support.');
        setIsLoading(false);
        return;
      }

      console.log('[Register] ✅ Profile created successfully!');

      // Check if email confirmation is required
      if (authData.session) {
        console.log('[Register] ✅ Auto-logged in! Redirecting to dashboard...');
        router.push('/dashboard');
        router.refresh();
      } else {
        console.log('[Register] 📧 Email confirmation required');
        setError('Registration successful! Please check your email to verify your account before logging in.');
        setIsLoading(false);
        // Redirect to login after showing message
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      }
    } catch (error) {
      console.error('[Register] 💥 Exception:', error);
      setError('An unexpected error occurred. Please try again or contact support.');
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-border/50 shadow-xl backdrop-blur-sm">
      <CardHeader className="space-y-2 pb-6">
        <CardTitle className="text-3xl font-bold tracking-tight">Create an account</CardTitle>
        <CardDescription className="text-base">
          Enter your information to get started
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200/50 p-4 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="space-y-2.5">
            <Label htmlFor="organizationName" className="text-sm font-semibold">Organization Name</Label>
            <Input
              id="organizationName"
              type="text"
              placeholder="Acme Inc."
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              required
              disabled={isLoading}
              className="h-11 rounded-xl border-border/50 focus-visible:ring-primary/30"
            />
          </div>

          <div className="space-y-2.5">
            <Label htmlFor="name" className="text-sm font-semibold">Your Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isLoading}
              className="h-11 rounded-xl border-border/50 focus-visible:ring-primary/30"
            />
          </div>

          <div className="space-y-2.5">
            <Label htmlFor="email" className="text-sm font-semibold">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              className="h-11 rounded-xl border-border/50 focus-visible:ring-primary/30"
            />
          </div>

          <div className="space-y-2.5">
            <Label htmlFor="password" className="text-sm font-semibold">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              disabled={isLoading}
              className="h-11 rounded-xl border-border/50 focus-visible:ring-primary/30"
            />
            <p className="text-xs text-muted-foreground">
              Must be at least 8 characters long
            </p>
          </div>

          <Button type="submit" className="w-full h-11 rounded-xl shadow-sm hover:shadow-md transition-all" disabled={isLoading}>
            {isLoading ? 'Creating account...' : 'Create account'}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

