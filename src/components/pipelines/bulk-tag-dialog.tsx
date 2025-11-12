'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface BulkTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stageId: string;
  contactIds: string[];
  onSuccess: () => void;
}

export function BulkTagDialog({
  open,
  onOpenChange,
  stageId,
  contactIds,
  onSuccess,
}: BulkTagDialogProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      fetchTags();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fetchTags = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/tags');
      const data = await response.json();

      if (response.ok) {
        setTags(data);
        if (data.length > 0 && !selectedTag) {
          setSelectedTag(data[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
      toast.error('Failed to load tags');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedTag || contactIds.length === 0) return;

    // Find the tag name from the selected tag ID
    const tag = tags.find((t) => t.id === selectedTag);
    if (!tag) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/pipelines/stages/${stageId}/contacts/bulk-tag`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contactIds,
            tagName: tag.name,
          }),
        }
      );

      if (response.ok) {
        toast.success(`Tagged ${contactIds.length} contact(s)`);
        onSuccess();
      } else {
        toast.error('Failed to tag contacts');
      }
    } catch (error) {
      console.error('Error tagging contacts:', error);
      toast.error('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Tag to Contacts</DialogTitle>
          <DialogDescription>
            Add a tag to {contactIds.length} selected contact(s)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="tag">Select Tag *</Label>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading tags...</div>
            ) : tags.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No tags available. Create tags first.
              </div>
            ) : (
              <Select value={selectedTag} onValueChange={setSelectedTag}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tag" />
                </SelectTrigger>
                <SelectContent>
                  {tags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedTag || tags.length === 0}
          >
            {isSubmitting ? 'Adding Tag...' : 'Add Tag'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

