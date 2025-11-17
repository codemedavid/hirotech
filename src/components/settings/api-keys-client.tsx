'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Key, Plus, Trash2, RefreshCw, CheckCircle2, XCircle, Clock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface ApiKey {
  id: string;
  name: string | null;
  status: 'ACTIVE' | 'RATE_LIMITED' | 'DISABLED';
  rateLimitedAt: string | null;
  lastUsedAt: string | null;
  lastSuccessAt: string | null;
  totalRequests: number;
  failedRequests: number;
  consecutiveFailures: number;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
  successRate: string;
  timeUntilActive: number | null;
}

interface ApiKeysClientProps {
  initialKeys?: ApiKey[];
}

export function ApiKeysClient({ initialKeys }: ApiKeysClientProps) {
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys ?? []);
  const [isLoading, setIsLoading] = useState(!initialKeys);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newKeyName, setNewKeyName] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);

  useEffect(() => {
    if (!initialKeys) {
      loadKeys();
    }
  }, [initialKeys]);

  async function loadKeys() {
    try {
      setIsLoading(true);
      const response = await fetch('/api/api-keys');
      if (!response.ok) {
        if (response.status === 403) {
          toast.error('Admin access required');
          return;
        }
        throw new Error('Failed to load API keys');
      }
      const data = await response.json();
      setKeys(data);
    } catch (error) {
      console.error('Error loading keys:', error);
      toast.error('Failed to load API keys');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddKey() {
    if (!newKey.trim()) {
      toast.error('API key is required');
      return;
    }

    try {
      // Support bulk paste (one key per line, with blank lines or extra text allowed)
      // Example accepted formats:
      // - "sk-or-v1-..."
      // - "> sir cj: sk-or-v1-..."
      const lines = newKey
        .split(/\r?\n/)
        .map(line => {
          const trimmed = line.trim();
          if (!trimmed) return '';
          const match = trimmed.match(/sk-or-v1-[a-z0-9]+/i);
          return match ? match[0] : '';
        })
        .filter(line => line.length > 0);

      const isBulk = lines.length > 1;

      const payload = isBulk
        ? {
            keys: lines.map((key, index) => ({
              key,
              name: newKeyName.trim()
                ? `${newKeyName.trim()} #${index + 1}`
                : undefined,
            })),
          }
        : {
            key: lines[0],
            name: newKeyName.trim() || null,
          };

      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add API key');
      }

      toast.success(isBulk ? 'API keys added successfully' : 'API key added successfully');
      setNewKey('');
      setNewKeyName('');
      setShowAddForm(false);
      setShowKeyInput(false);
      loadKeys();
    } catch (error) {
      console.error('Error adding key:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add API key');
    }
  }

  async function handleUpdateStatus(keyId: string, status: 'ACTIVE' | 'RATE_LIMITED' | 'DISABLED') {
    try {
      const response = await fetch(`/api/api-keys/${keyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error('Failed to update key status');
      }

      toast.success('Key status updated');
      loadKeys();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update key status');
    }
  }

  async function handleDeleteKey(keyId: string) {
    if (!confirm('Are you sure you want to disable this API key?')) {
      return;
    }

    try {
      const response = await fetch(`/api/api-keys/${keyId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete key');
      }

      toast.success('API key disabled');
      loadKeys();
    } catch (error) {
      console.error('Error deleting key:', error);
      toast.error('Failed to disable API key');
    }
  }

  function formatTimeUntilActive(ms: number | null): string {
    if (!ms || ms <= 0) return '';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3" />
            Active
          </span>
        );
      case 'RATE_LIMITED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
            <Clock className="h-3 w-3" />
            Rate Limited
          </span>
        );
      case 'DISABLED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
            <XCircle className="h-3 w-3" />
            Disabled
          </span>
        );
      default:
        return null;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API Keys Management</h1>
          <p className="text-muted-foreground mt-1">Manage API keys for AI services</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadKeys}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowAddForm(!showAddForm)}>
            <Plus className="h-4 w-4 mr-2" />
            Add API Key
          </Button>
        </div>
      </div>

      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New API Key</CardTitle>
            <CardDescription>Enter a new API key to add to the rotation pool</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key-name">Name (optional)</Label>
              <Input
                id="key-name"
                placeholder="e.g., Production Key #1"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="key-value">
                API Key(s)
                <span className="ml-1 text-xs text-muted-foreground">
                  (one per line)
                </span>
              </Label>
              <div className="relative">
                <Textarea
                  id="key-value"
                  placeholder="Paste one or more API keys&#10;sk-or-v1-...&#10;sk-or-v1-..."
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="min-h-[160px] pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute right-1 top-1.5"
                  onClick={() => setShowKeyInput(!showKeyInput)}
                >
                  {showKeyInput ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddKey} disabled={!newKey.trim()}>
                Add Key
              </Button>
              <Button variant="outline" onClick={() => {
                setShowAddForm(false);
                setNewKey('');
                setNewKeyName('');
                setShowKeyInput(false);
              }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>
            Manage your API keys. Keys are automatically rotated when rate limits are hit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner className="h-8 w-8" />
            </div>
          ) : keys.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No API keys configured</p>
              <p className="text-sm mt-2">Add your first API key to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{key.name || 'Unnamed Key'}</h3>
                      {getStatusBadge(key.status)}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>ID: {key.id}</p>
                      <div className="flex gap-4">
                        <span>Requests: {key.totalRequests.toLocaleString()}</span>
                        <span>Success Rate: {key.successRate}%</span>
                        {key.lastUsedAt && (
                          <span>Last Used: {new Date(key.lastUsedAt).toLocaleString()}</span>
                        )}
                      </div>
                      {key.status === 'RATE_LIMITED' && key.timeUntilActive && (
                        <p className="text-yellow-600 dark:text-yellow-400">
                          Available in: {formatTimeUntilActive(key.timeUntilActive)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {key.status === 'RATE_LIMITED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUpdateStatus(key.id, 'ACTIVE')}
                        title="Manually re-enable (before 24h)"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Re-enable
                      </Button>
                    )}
                    {key.status === 'DISABLED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUpdateStatus(key.id, 'ACTIVE')}
                      >
                        Enable
                      </Button>
                    )}
                    {key.status === 'ACTIVE' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUpdateStatus(key.id, 'DISABLED')}
                      >
                        Disable
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteKey(key.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

