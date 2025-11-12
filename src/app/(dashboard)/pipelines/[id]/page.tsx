'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit2,
  Users,
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { PipelineStageCard } from '@/components/pipelines/pipeline-stage-card';
import { AddStageDialog } from '@/components/pipelines/add-stage-dialog';
import { EditPipelineDialog } from '@/components/pipelines/edit-pipeline-dialog';
import { AddContactsDialog } from '@/components/pipelines/add-contacts-dialog';
import { BulkTagDialog } from '@/components/pipelines/bulk-tag-dialog';
import { ContactCard } from '@/components/pipelines/contact-card';
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

interface Contact {
  id: string;
  firstName: string;
  lastName?: string;
  profilePicUrl?: string;
  leadScore: number;
  tags: string[];
}

interface Stage {
  id: string;
  name: string;
  color: string;
  type: string;
  contacts: Contact[];
  _count: {
    contacts: number;
  };
}

interface Pipeline {
  id: string;
  name: string;
  description?: string;
  color: string;
  stages: Stage[];
}

export default function PipelinePage() {
  const params = useParams();
  const router = useRouter();
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [stageSearchQueries, setStageSearchQueries] = useState<Record<string, string>>({});
  const [stagePagination, setStagePagination] = useState<Record<string, number>>({});
  const [selectedStageContacts, setSelectedStageContacts] = useState<
    Record<string, Set<string>>
  >({});
  const [selectedStages, setSelectedStages] = useState<Set<string>>(new Set());
  const [showAddStageDialog, setShowAddStageDialog] = useState(false);
  const [showEditPipelineDialog, setShowEditPipelineDialog] = useState(false);
  const [showDeleteStagesDialog, setShowDeleteStagesDialog] = useState(false);
  const [showAddContactsDialog, setShowAddContactsDialog] = useState(false);
  const [showBulkTagDialog, setShowBulkTagDialog] = useState(false);
  const [selectedStageForTag, setSelectedStageForTag] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const fetchPipeline = useCallback(async () => {
    try {
      const response = await fetch(`/api/pipelines/${params.id}`);
      const data = await response.json();
      if (response.ok) {
        setPipeline(data);
      }
    } catch (error) {
      console.error('Error fetching pipeline:', error);
      toast.error('Failed to fetch pipeline');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchPipeline();
  }, [fetchPipeline]);

  const handleDragStart = (event: DragStartEvent) => {
    const contact = event.active.data.current as Contact;
    setActiveContact(contact);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveContact(null);

    if (!over || !pipeline) return;

    const contactId = active.id as string;
    const targetStageId = over.id as string;

    // Find source stage
    const sourceStage = pipeline.stages.find((stage) =>
      stage.contacts.some((c) => c.id === contactId)
    );

    if (!sourceStage || sourceStage.id === targetStageId) return;

    // Optimistically update UI
    const updatedPipeline = {
      ...pipeline,
      stages: pipeline.stages.map((stage) => {
        if (stage.id === sourceStage.id) {
          return {
            ...stage,
            contacts: stage.contacts.filter((c) => c.id !== contactId),
            _count: { contacts: stage._count.contacts - 1 },
          };
        }
        if (stage.id === targetStageId) {
          const contact = sourceStage.contacts.find((c) => c.id === contactId)!;
          return {
            ...stage,
            contacts: [contact, ...stage.contacts],
            _count: { contacts: stage._count.contacts + 1 },
          };
        }
        return stage;
      }),
    };
    setPipeline(updatedPipeline);

    // Make API call
    try {
      const response = await fetch(`/api/contacts/${contactId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId: targetStageId }),
      });

      if (!response.ok) {
        // Revert on error
        setPipeline(pipeline);
        toast.error('Failed to move contact');
      } else {
        toast.success('Contact moved successfully');
      }
    } catch (error) {
      console.error('Error moving contact:', error);
      setPipeline(pipeline);
      toast.error('An error occurred');
    }
  };

  const handleStageSearch = async (stageId: string, query: string) => {
    setStageSearchQueries((prev) => ({ ...prev, [stageId]: query }));

    if (!query.trim()) {
      await fetchPipeline();
      return;
    }

    try {
      const response = await fetch(
        `/api/pipelines/stages/${stageId}/contacts?search=${encodeURIComponent(query)}&page=1&limit=50`
      );
      const data = await response.json();

      if (response.ok && pipeline) {
        const updatedPipeline = {
          ...pipeline,
          stages: pipeline.stages.map((stage) =>
            stage.id === stageId
              ? { ...stage, contacts: data.contacts }
              : stage
          ),
        };
        setPipeline(updatedPipeline);
      }
    } catch (error) {
      console.error('Error searching stage contacts:', error);
    }
  };

  const handleStagePagination = async (stageId: string, page: number) => {
    setStagePagination((prev) => ({ ...prev, [stageId]: page }));

    try {
      const searchQuery = stageSearchQueries[stageId] || '';
      const response = await fetch(
        `/api/pipelines/stages/${stageId}/contacts?search=${encodeURIComponent(searchQuery)}&page=${page}&limit=50`
      );
      const data = await response.json();

      if (response.ok && pipeline) {
        const updatedPipeline = {
          ...pipeline,
          stages: pipeline.stages.map((stage) =>
            stage.id === stageId
              ? { ...stage, contacts: data.contacts }
              : stage
          ),
        };
        setPipeline(updatedPipeline);
      }
    } catch (error) {
      console.error('Error loading page:', error);
      toast.error('Failed to load contacts');
    }
  };

  const toggleContactSelection = (stageId: string, contactId: string) => {
    setSelectedStageContacts((prev) => {
      const stageContacts = new Set(prev[stageId] || []);
      if (stageContacts.has(contactId)) {
        stageContacts.delete(contactId);
      } else {
        stageContacts.add(contactId);
      }
      return { ...prev, [stageId]: stageContacts };
    });
  };

  const toggleStageSelection = (stageId: string) => {
    const newSelection = new Set(selectedStages);
    if (newSelection.has(stageId)) {
      newSelection.delete(stageId);
    } else {
      newSelection.add(stageId);
    }
    setSelectedStages(newSelection);
  };

  const handleBulkRemoveContacts = async (stageId: string) => {
    const contactIds = Array.from(selectedStageContacts[stageId] || []);
    if (contactIds.length === 0) return;

    try {
      const response = await fetch(
        `/api/pipelines/stages/${stageId}/contacts/bulk-remove`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contactIds }),
        }
      );

      if (response.ok) {
        toast.success(`Removed ${contactIds.length} contact(s)`);
        setSelectedStageContacts((prev) => ({ ...prev, [stageId]: new Set() }));
        await fetchPipeline();
      } else {
        toast.error('Failed to remove contacts');
      }
    } catch (error) {
      console.error('Error removing contacts:', error);
      toast.error('An error occurred');
    }
  };

  const handleBulkDeleteStages = async () => {
    if (selectedStages.size === 0) return;

    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/pipelines/${params.id}/stages/bulk-delete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stageIds: Array.from(selectedStages) }),
        }
      );

      if (response.ok) {
        toast.success(`Deleted ${selectedStages.size} stage(s)`);
        setSelectedStages(new Set());
        await fetchPipeline();
      } else {
        toast.error('Failed to delete stages');
      }
    } catch (error) {
      console.error('Error deleting stages:', error);
      toast.error('An error occurred');
    } finally {
      setIsDeleting(false);
      setShowDeleteStagesDialog(false);
    }
  };

  const handleAddStage = async (stageData: {
    name: string;
    description?: string;
    color: string;
    type: string;
  }) => {
    try {
      const response = await fetch(`/api/pipelines/${params.id}/stages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stageData),
      });

      if (response.ok) {
        toast.success('Stage added successfully');
        setShowAddStageDialog(false);
        await fetchPipeline();
      } else {
        toast.error('Failed to add stage');
      }
    } catch (error) {
      console.error('Error adding stage:', error);
      toast.error('An error occurred');
    }
  };

  const handleUpdatePipeline = async (pipelineData: {
    name: string;
    description?: string;
    color: string;
  }) => {
    try {
      const response = await fetch(`/api/pipelines/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pipelineData),
      });

      if (response.ok) {
        toast.success('Pipeline updated successfully');
        setShowEditPipelineDialog(false);
        await fetchPipeline();
      } else {
        toast.error('Failed to update pipeline');
      }
    } catch (error) {
      console.error('Error updating pipeline:', error);
      toast.error('An error occurred');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!pipeline) {
    return <div>Pipeline not found</div>;
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.push('/pipelines')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {selectedStages.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteStagesDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Stages ({selectedStages.size})
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddContactsDialog(true)}
            >
              <Users className="h-4 w-4 mr-2" />
              Add Contacts
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddStageDialog(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Stage
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditPipelineDialog(true)}
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: pipeline.color }}
            />
            <h1 className="text-3xl font-bold">{pipeline.name}</h1>
          </div>
          {pipeline.description && (
            <p className="text-muted-foreground mt-2">{pipeline.description}</p>
          )}
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4">
          {pipeline.stages.map((stage) => {
            const currentPage = stagePagination[stage.id] || 1;
            const totalPages = Math.ceil(stage._count.contacts / 50);
            const selectedContacts = selectedStageContacts[stage.id] || new Set();

            return (
              <PipelineStageCard
                key={stage.id}
                stage={stage}
                isSelected={selectedStages.has(stage.id)}
                selectedContacts={selectedContacts}
                searchQuery={stageSearchQueries[stage.id] || ''}
                currentPage={currentPage}
                totalPages={totalPages}
                onToggleSelection={() => toggleStageSelection(stage.id)}
                onSearchChange={(query) => handleStageSearch(stage.id, query)}
                onToggleContactSelection={toggleContactSelection}
                onRemoveSelected={() => handleBulkRemoveContacts(stage.id)}
                onAddTag={() => {
                  setSelectedStageForTag(stage.id);
                  setShowBulkTagDialog(true);
                }}
                onPageChange={(page) => handleStagePagination(stage.id, page)}
              />
            );
          })}
        </div>

        <DragOverlay>
          {activeContact && <ContactCard contact={activeContact} isDragging />}
        </DragOverlay>
      </div>

      {showAddStageDialog && (
        <AddStageDialog
          open={showAddStageDialog}
          onOpenChange={setShowAddStageDialog}
          onSubmit={handleAddStage}
        />
      )}

      {showEditPipelineDialog && pipeline && (
        <EditPipelineDialog
          open={showEditPipelineDialog}
          onOpenChange={setShowEditPipelineDialog}
          pipeline={pipeline}
          onSubmit={handleUpdatePipeline}
        />
      )}

      {showAddContactsDialog && (
        <AddContactsDialog
          open={showAddContactsDialog}
          onOpenChange={setShowAddContactsDialog}
          stages={pipeline.stages}
          onSuccess={fetchPipeline}
        />
      )}

      {showBulkTagDialog && selectedStageForTag && (
        <BulkTagDialog
          open={showBulkTagDialog}
          onOpenChange={setShowBulkTagDialog}
          stageId={selectedStageForTag}
          contactIds={Array.from(selectedStageContacts[selectedStageForTag] || [])}
          onSuccess={async () => {
            setShowBulkTagDialog(false);
            setSelectedStageForTag(null);
            await fetchPipeline();
          }}
        />
      )}

      <AlertDialog open={showDeleteStagesDialog} onOpenChange={setShowDeleteStagesDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stages?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedStages.size} stage(s). Contacts in these
              stages will be removed from the pipeline. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteStages}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DndContext>
  );
}
