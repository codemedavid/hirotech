'use client';

import { useState, useTransition, useOptimistic } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { addTagToContact, removeTagFromContact } from '@/app/actions/contact-tags';

interface Tag {
  id?: string;
  name: string;
  color: string;
}

interface ContactTagEditorOptimizedProps {
  contactId: string;
  currentTags: string[];
  availableTags: Tag[];
}

export function ContactTagEditorOptimized({
  contactId,
  currentTags,
  availableTags,
}: ContactTagEditorOptimizedProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  
  // Optimistic updates for instant UI feedback
  const [optimisticTags, addOptimisticTag] = useOptimistic(
    currentTags,
    (state, newTag: { action: 'add' | 'remove'; tag: string }) => {
      if (newTag.action === 'add') {
        return [...state, newTag.tag];
      } else {
        return state.filter(t => t !== newTag.tag);
      }
    }
  );

  async function handleAddTag(tag: string) {
    // Optimistic update
    addOptimisticTag({ action: 'add', tag });
    setOpen(false);

    startTransition(async () => {
      const result = await addTagToContact(contactId, tag);
      
      if (!result.success) {
        toast.error(result.error || 'Failed to add tag');
      } else {
        toast.success('Tag added');
      }
    });
  }

  async function handleRemoveTag(tag: string) {
    // Optimistic update
    addOptimisticTag({ action: 'remove', tag });

    startTransition(async () => {
      const result = await removeTagFromContact(contactId, tag);
      
      if (!result.success) {
        toast.error(result.error || 'Failed to remove tag');
      } else {
        toast.success('Tag removed');
      }
    });
  }

  const unassignedTags = availableTags.filter(
    (tag) => !optimisticTags.includes(tag.name)
  );

  return (
    <div className="flex flex-wrap gap-2">
      {optimisticTags.map((tagName) => {
        const tag = availableTags.find((t) => t.name === tagName);
        return (
          <Badge
            key={tagName}
            variant="secondary"
            className="gap-1 transition-opacity"
            style={
              tag
                ? { backgroundColor: `${tag.color}20`, color: tag.color }
                : {}
            }
          >
            {tagName}
            <button
              onClick={() => handleRemoveTag(tagName)}
              disabled={isPending}
              className="ml-1 hover:bg-background/50 rounded-full disabled:opacity-50"
              aria-label={`Remove ${tagName} tag`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        );
      })}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7"
            disabled={isPending || unassignedTags.length === 0}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-56" align="start">
          <Command>
            <CommandInput placeholder="Search tags..." />
            <CommandEmpty>No tags found.</CommandEmpty>
            <CommandGroup>
              {unassignedTags.map((tag) => (
                <CommandItem
                  key={tag.name}
                  onSelect={() => handleAddTag(tag.name)}
                  disabled={isPending}
                >
                  <div
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

