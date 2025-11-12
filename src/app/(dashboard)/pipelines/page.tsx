'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, GitBranch, Search, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Pipeline {
  id: string;
  name: string;
  description?: string;
  color: string;
  stages: Array<{
    id: string;
    name: string;
    _count: {
      contacts: number;
    };
  }>;
}

export default function PipelinesPage() {
  const router = useRouter();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [filteredPipelines, setFilteredPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPipelines, setSelectedPipelines] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchPipelines();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      setFilteredPipelines(
        pipelines.filter(
          (pipeline) =>
            pipeline.name.toLowerCase().includes(query) ||
            pipeline.description?.toLowerCase().includes(query)
        )
      );
    } else {
      setFilteredPipelines(pipelines);
    }
  }, [searchQuery, pipelines]);

  const fetchPipelines = async () => {
    try {
      const response = await fetch('/api/pipelines');
      const data = await response.json();
      if (response.ok) {
        setPipelines(data);
        setFilteredPipelines(data);
      }
    } catch (error) {
      console.error('Error fetching pipelines:', error);
      toast.error('Failed to fetch pipelines');
    } finally {
      setLoading(false);
    }
  };

  const togglePipelineSelection = (pipelineId: string) => {
    const newSelection = new Set(selectedPipelines);
    if (newSelection.has(pipelineId)) {
      newSelection.delete(pipelineId);
    } else {
      newSelection.add(pipelineId);
    }
    setSelectedPipelines(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedPipelines.size === filteredPipelines.length) {
      setSelectedPipelines(new Set());
    } else {
      setSelectedPipelines(new Set(filteredPipelines.map((p) => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedPipelines.size === 0) return;

    setIsDeleting(true);
    try {
      const response = await fetch('/api/pipelines/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineIds: Array.from(selectedPipelines) }),
      });

      if (response.ok) {
        toast.success(`Successfully deleted ${selectedPipelines.size} pipeline(s)`);
        setSelectedPipelines(new Set());
        await fetchPipelines();
      } else {
        toast.error('Failed to delete pipelines');
      }
    } catch (error) {
      console.error('Error deleting pipelines:', error);
      toast.error('An error occurred');
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pipelines</h1>
          <p className="text-muted-foreground mt-2">
            Manage your sales and support pipelines
          </p>
        </div>

        <Button onClick={() => router.push('/pipelines/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Create Pipeline
        </Button>
      </div>

      {pipelines.length === 0 ? (
        <EmptyState
          icon={<GitBranch className="h-12 w-12" />}
          title="No pipelines yet"
          description="Create a pipeline to track contacts through stages"
          action={{
            label: 'Create Pipeline',
            onClick: () => router.push('/pipelines/new'),
          }}
        />
      ) : (
        <>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search pipelines..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {selectedPipelines.size > 0 && (
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete ({selectedPipelines.size})
              </Button>
            )}

            {filteredPipelines.length > 0 && (
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedPipelines.size === filteredPipelines.length}
                  onCheckedChange={toggleSelectAll}
                  id="select-all"
                />
                <label htmlFor="select-all" className="text-sm cursor-pointer">
                  Select All
                </label>
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredPipelines.map((pipeline) => {
              const totalContacts = pipeline.stages.reduce(
                (sum, stage) => sum + stage._count.contacts,
                0
              );
              const isSelected = selectedPipelines.has(pipeline.id);

              return (
                <div key={pipeline.id} className="relative">
                  <div className="absolute top-4 left-4 z-10">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => togglePipelineSelection(pipeline.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <Link href={`/pipelines/${pipeline.id}`}>
                    <Card
                      className={`hover:shadow-md transition-shadow cursor-pointer ${
                        isSelected ? 'ring-2 ring-primary' : ''
                      }`}
                    >
                      <CardHeader className="pb-3 pl-12">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: pipeline.color }}
                          />
                          <CardTitle className="text-lg">{pipeline.name}</CardTitle>
                        </div>
                        {pipeline.description && (
                          <p className="text-sm text-muted-foreground mt-2">
                            {pipeline.description}
                          </p>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-3 pl-12">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            {pipeline.stages.length} stages
                          </span>
                          <Badge variant="secondary">{totalContacts} contacts</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </div>
              );
            })}
          </div>

          {filteredPipelines.length === 0 && searchQuery && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No pipelines found matching &quot;{searchQuery}&quot;</p>
            </div>
          )}
        </>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedPipelines.size} pipeline(s) and all their stages.
              Contacts will be removed from these pipelines. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
