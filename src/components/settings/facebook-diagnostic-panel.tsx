'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { 
  AlertCircle, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  RefreshCw,
  Database,
  Key,
  Globe,
  Facebook,
} from 'lucide-react';
import { toast } from 'sonner';

interface DiagnosticReport {
  timestamp: string;
  overallStatus: {
    healthy: boolean;
    readyForFacebookOAuth: boolean;
    criticalIssues: string[];
    warnings: string[];
    recommendations: string[];
  };
  authentication: {
    authenticated: boolean;
    userId: string | null;
    organizationId: string | null;
  };
  environment: Record<string, unknown>;
  database: {
    connected: boolean;
    error: string | null;
    facebookPagesCount: number;
  };
  urls: {
    oauthCallback: string;
    oauthCallbackPopup: string;
    webhook: string;
  };
  connectedPages: {
    count: number;
    recent: Array<{
      id: string;
      pageId: string;
      pageName: string;
      isActive: boolean;
      hasInstagram: boolean;
      createdAt: string;
      updatedAt: string;
    }>;
  };
  nextSteps: string[];
}

export function FacebookDiagnosticPanel() {
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTestingSave, setIsTestingSave] = useState(false);

  async function runDiagnostics() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/facebook/debug');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Diagnostic check failed');
      }
      
      setReport(data);
      
      if (data.overallStatus.healthy) {
        toast.success('System is healthy!');
      } else {
        toast.error('Issues detected - check the report');
      }
    } catch (error) {
      console.error('Diagnostic error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to run diagnostics');
    } finally {
      setIsLoading(false);
    }
  }

  async function testDatabaseSave() {
    setIsTestingSave(true);
    try {
      // Test create
      const createResponse = await fetch('/api/facebook/test-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testMode: 'create' }),
      });
      
      const createData = await createResponse.json();
      
      if (createData.success) {
        toast.success('✅ Database save test passed!');
        
        // Clean up test data
        setTimeout(async () => {
          await fetch('/api/facebook/test-save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ testMode: 'cleanup' }),
          });
        }, 2000);
        
        // Re-run diagnostics
        runDiagnostics();
      } else {
        toast.error(`❌ Database save test failed: ${createData.message}`);
      }
    } catch (error) {
      console.error('Test save error:', error);
      toast.error(error instanceof Error ? error.message : 'Test failed');
    } finally {
      setIsTestingSave(false);
    }
  }

  return (
    <Card className="border-2 border-orange-200 dark:border-orange-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          Facebook Integration Diagnostics
        </CardTitle>
        <CardDescription>
          Check your Facebook integration setup and troubleshoot connection issues
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={runDiagnostics} 
            disabled={isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <>
                <LoadingSpinner className="h-4 w-4" />
                Running Diagnostics...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Run Diagnostics
              </>
            )}
          </Button>
          
          {report && (
            <Button 
              onClick={testDatabaseSave}
              disabled={isTestingSave || !report.database.connected}
              variant="outline"
              className="gap-2"
            >
              {isTestingSave ? (
                <>
                  <LoadingSpinner className="h-4 w-4" />
                  Testing...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4" />
                  Test Database Save
                </>
              )}
            </Button>
          )}
        </div>

        {report && (
          <div className="space-y-4 mt-6">
            {/* Overall Status */}
            <Alert variant={report.overallStatus.healthy ? 'default' : 'destructive'}>
              {report.overallStatus.healthy ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertTitle>
                {report.overallStatus.healthy ? 'System Healthy' : 'Issues Detected'}
              </AlertTitle>
              <AlertDescription>
                {report.overallStatus.healthy 
                  ? 'All systems are functioning correctly'
                  : `Found ${report.overallStatus.criticalIssues.length} critical issue(s) and ${report.overallStatus.warnings.length} warning(s)`
                }
              </AlertDescription>
            </Alert>

            {/* Critical Issues */}
            {report.overallStatus.criticalIssues.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Critical Issues
                </h3>
                <ul className="space-y-1">
                  {report.overallStatus.criticalIssues.map((issue, i) => (
                    <li key={i} className="text-sm text-red-600 dark:text-red-400 ml-6">
                      • {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings */}
            {report.overallStatus.warnings.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Warnings
                </h3>
                <ul className="space-y-1">
                  {report.overallStatus.warnings.map((warning, i) => (
                    <li key={i} className="text-sm text-orange-600 dark:text-orange-400 ml-6">
                      • {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* System Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Authentication */}
              <div className="space-y-2 p-3 border rounded-lg">
                <h4 className="font-medium flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Authentication
                </h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant={report.authentication.authenticated ? 'default' : 'destructive'}>
                      {report.authentication.authenticated ? 'Authenticated' : 'Not Authenticated'}
                    </Badge>
                  </div>
                  {report.authentication.organizationId && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Org ID:</span>
                      <code className="text-xs">{report.authentication.organizationId.slice(0, 8)}...</code>
                    </div>
                  )}
                </div>
              </div>

              {/* Database */}
              <div className="space-y-2 p-3 border rounded-lg">
                <h4 className="font-medium flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Database
                </h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant={report.database.connected ? 'default' : 'destructive'}>
                      {report.database.connected ? 'Connected' : 'Disconnected'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">FB Pages:</span>
                    <span className="font-mono">{report.database.facebookPagesCount}</span>
                  </div>
                  {report.database.error && (
                    <div className="text-xs text-red-600 mt-2">
                      Error: {report.database.error}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* URLs */}
            <div className="space-y-2 p-3 border rounded-lg">
              <h4 className="font-medium flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Callback URLs (Add these to Facebook App Settings)
              </h4>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-muted-foreground">OAuth Redirect:</span>
                  <code className="block bg-muted px-2 py-1 rounded mt-1">
                    {report.urls.oauthCallback}
                  </code>
                </div>
                <div>
                  <span className="text-muted-foreground">OAuth Redirect (Popup):</span>
                  <code className="block bg-muted px-2 py-1 rounded mt-1">
                    {report.urls.oauthCallbackPopup}
                  </code>
                </div>
                <div>
                  <span className="text-muted-foreground">Webhook:</span>
                  <code className="block bg-muted px-2 py-1 rounded mt-1">
                    {report.urls.webhook}
                  </code>
                </div>
              </div>
            </div>

            {/* Connected Pages */}
            {report.connectedPages.recent.length > 0 && (
              <div className="space-y-2 p-3 border rounded-lg">
                <h4 className="font-medium flex items-center gap-2">
                  <Facebook className="h-4 w-4 text-blue-600" />
                  Recent Connected Pages ({report.connectedPages.count} total)
                </h4>
                <div className="space-y-2">
                  {report.connectedPages.recent.map((page) => (
                    <div key={page.id} className="flex justify-between items-center text-sm border-b pb-2">
                      <div>
                        <div className="font-medium">{page.pageName}</div>
                        <div className="text-xs text-muted-foreground">ID: {page.pageId}</div>
                      </div>
                      <div className="flex gap-2">
                        {page.hasInstagram && (
                          <Badge variant="secondary" className="text-xs">IG</Badge>
                        )}
                        <Badge variant={page.isActive ? 'default' : 'secondary'} className="text-xs">
                          {page.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next Steps */}
            {report.nextSteps.length > 0 && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Next Steps</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    {report.nextSteps.map((step, i) => (
                      <li key={i} className="text-sm">{step}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

