'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Facebook, Search, X, Users } from 'lucide-react';
import { toast } from 'sonner';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

// Code-split heavy components for better performance
const FacebookPageSelectorDialog = dynamic(
  () => import('@/components/integrations/facebook-page-selector-dialog').then(mod => ({ default: mod.FacebookPageSelectorDialog })),
  {
    loading: () => (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner className="h-8 w-8" />
      </div>
    ),
    ssr: false
  }
);

const ConnectedPagesList = dynamic(
  () => import('@/components/integrations/connected-pages-list').then(mod => ({ default: mod.ConnectedPagesList })),
  {
    loading: () => (
      <Card>
        <CardHeader>
          <CardTitle>Connected Pages</CardTitle>
          <CardDescription>Loading your connected pages...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner className="h-8 w-8" />
          </div>
        </CardContent>
      </Card>
    ),
    ssr: false
  }
);

const FacebookDiagnosticPanel = dynamic(
  () => import('@/components/settings/facebook-diagnostic-panel').then(mod => ({ default: mod.FacebookDiagnosticPanel })),
  {
    loading: () => (
      <Card>
        <CardHeader>
          <CardTitle>Diagnostics</CardTitle>
          <CardDescription>Loading diagnostic tools...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner className="h-8 w-8" />
          </div>
        </CardContent>
      </Card>
    ),
    ssr: false
  }
);

interface IntegrationsClientProps {
  initialTotalContacts: number;
}

export function IntegrationsClient({ initialTotalContacts }: IntegrationsClientProps) {
  const [showPageSelector, setShowPageSelector] = useState(false);
  const [userAccessToken, setUserAccessToken] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalContacts, setTotalContacts] = useState<number>(initialTotalContacts);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [appOrigin, setAppOrigin] = useState('');
  const searchParams = useSearchParams();

  // Set appOrigin after hydration to avoid mismatch
  useEffect(() => {
    setAppOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    // Handle OAuth callback
    const facebookAuth = searchParams.get('facebook_auth');
    const fbToken = searchParams.get('fb_token');
    const error = searchParams.get('error');
    const errorDetails = searchParams.get('error_details');
    let hasHandled = false;

    // Use setTimeout to avoid setState in effect warning
    if (error && !hasHandled) {
      hasHandled = true;
      let errorMessage = 'Failed to connect Facebook';
      switch (error) {
        case 'access_denied':
          errorMessage = 'Facebook authorization was cancelled';
          break;
        case 'missing_code':
          errorMessage = 'Invalid Facebook response';
          break;
        case 'invalid_state':
          errorMessage = 'Security validation failed';
          break;
        case 'callback_failed':
          errorMessage = errorDetails 
            ? `Failed to complete Facebook connection: ${decodeURIComponent(errorDetails)}`
            : 'Failed to complete Facebook connection. Check server logs for details.';
          break;
      }
      toast.error(errorMessage, { duration: 10000 });
      // Clear error from URL
      window.history.replaceState({}, '', '/settings/integrations');
    }

    if (facebookAuth === 'success' && fbToken && !hasHandled) {
      hasHandled = true;
      setTimeout(() => {
        setUserAccessToken(fbToken);
        setShowPageSelector(true);
        // Clear params from URL
        window.history.replaceState({}, '', '/settings/integrations');
      }, 0);
    }
  }, [searchParams]);

  function handleConnectFacebook() {
    // Open OAuth in popup window for better UX
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    
    const popup = window.open(
      '/api/facebook/oauth?popup=true',
      'Facebook Login',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`
    );

    // Listen for popup to close or send message
    const checkPopup = setInterval(() => {
      if (popup && popup.closed) {
        clearInterval(checkPopup);
        // Popup closed, check for success in URL or reload to check connection
        console.log('Facebook OAuth popup closed');
        // Trigger a refresh of connected pages list
        setRefreshKey(prev => prev + 1);
      }
    }, 500);

    // Listen for messages from popup
    const handleMessage = (event: MessageEvent) => {
      // Verify origin for security
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'FACEBOOK_AUTH_SUCCESS') {
        console.log('Facebook auth successful via popup');
        if (event.data.token) {
          setUserAccessToken(event.data.token);
          setShowPageSelector(true);
        }
        if (popup) popup.close();
        window.removeEventListener('message', handleMessage);
      } else if (event.data.type === 'FACEBOOK_AUTH_ERROR') {
        console.error('Facebook auth error:', event.data.error);
        toast.error(event.data.error || 'Failed to connect Facebook');
        if (popup) popup.close();
        window.removeEventListener('message', handleMessage);
      }
    };

    window.addEventListener('message', handleMessage);
  }

  function handlePagesConnected() {
    setUserAccessToken('');
    setRefreshKey(prev => prev + 1);
  }

  function handleRefresh() {
    setRefreshKey(prev => prev + 1);
    fetchTotalContacts();
  }

  // Fetch total contacts count
  async function fetchTotalContacts() {
    try {
      setIsLoadingContacts(true);
      const response = await fetch('/api/contacts/total-count');
      if (response.ok) {
        const data = await response.json();
        setTotalContacts(data.count);
      }
    } catch (error) {
      console.error('Error fetching total contacts:', error);
    } finally {
      setIsLoadingContacts(false);
    }
  }

  // Fetch total contacts on mount
  useEffect(() => {
    fetchTotalContacts();
  }, [refreshKey]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Integrations</h1>
        <p className="text-muted-foreground mt-2">
          Connect your Facebook pages for Messenger bulk messaging
        </p>
      </div>

      {/* Diagnostic Panel */}
      <FacebookDiagnosticPanel />

      {/* Total Contacts Counter */}
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Total Contacts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
            {isLoadingContacts ? (
              <span className="animate-pulse">...</span>
            ) : (
              totalContacts.toLocaleString()
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Synced contacts across all connected pages
          </p>
        </CardContent>
      </Card>

      {/* Search Box */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search connected pages by name, ID, or Instagram username..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-10"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchQuery('')}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Clear search</span>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Facebook className="h-5 w-5 text-blue-600" />
            Facebook Messenger
          </CardTitle>
          <CardDescription>
            Connect your Facebook pages to send bulk messages via Messenger
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleConnectFacebook} size="lg">
            <Facebook className="mr-2 h-5 w-5" />
            Connect with Facebook
          </Button>
          <p className="text-sm text-muted-foreground mt-4">
            You&apos;ll be redirected to Facebook to authorize access to your pages.
            You can select multiple pages at once.
          </p>
        </CardContent>
      </Card>

      <Suspense fallback={
        <Card>
          <CardHeader>
            <CardTitle>Connected Pages</CardTitle>
            <CardDescription>Loading your connected pages...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner className="h-8 w-8" />
            </div>
          </CardContent>
        </Card>
      }>
        <ConnectedPagesList 
          key={refreshKey} 
          onRefresh={handleRefresh}
          onSyncComplete={fetchTotalContacts}
        />
      </Suspense>

      <Card>
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
          <CardDescription>
            Make sure your Facebook app is configured properly
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">1. Create a Facebook App</h4>
            <p className="text-sm text-muted-foreground">
              Go to{' '}
              <a
                href="https://developers.facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                developers.facebook.com
              </a>{' '}
              and create a new app with Messenger product
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">2. Add Required Permissions</h4>
            <p className="text-sm text-muted-foreground">
              Your app needs these permissions: pages_show_list, pages_messaging,
              pages_read_engagement, pages_manage_metadata
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">3. Configure OAuth Redirect</h4>
            <p className="text-sm text-muted-foreground">
              Add these URLs to your Facebook App&apos;s OAuth redirect URIs:
            </p>
            <code className="block bg-muted px-3 py-2 rounded text-sm mb-2">
              {appOrigin ? `${appOrigin}/api/facebook/callback` : 'Loading...'}
            </code>
            <code className="block bg-muted px-3 py-2 rounded text-sm">
              {appOrigin ? `${appOrigin}/api/facebook/callback-popup` : 'Loading...'}
            </code>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">4. Configure Webhook</h4>
            <p className="text-sm text-muted-foreground">
              Set up your webhook to receive messages:
            </p>
            <div className="space-y-1">
              <p className="text-sm">
                <span className="font-medium">Callback URL:</span>
              </p>
              <code className="block bg-muted px-3 py-2 rounded text-sm">
                {appOrigin ? `${appOrigin}/api/webhooks/facebook` : 'Loading...'}
              </code>
              <p className="text-sm mt-2">
                <span className="font-medium">Verify Token:</span> Check your .env file
                for FACEBOOK_WEBHOOK_VERIFY_TOKEN
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <FacebookPageSelectorDialog
        open={showPageSelector}
        onOpenChange={setShowPageSelector}
        userAccessToken={userAccessToken}
        onPagesConnected={handlePagesConnected}
      />
    </div>
  );
}

