'use client';

import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Trash2, Tag as TagIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { ContactCard } from './contact-card';
import Link from 'next/link';

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

interface PipelineStageCardProps {
  stage: Stage;
  isSelected: boolean;
  selectedContacts: Set<string>;
  searchQuery: string;
  currentPage: number;
  totalPages: number;
  onToggleSelection: () => void;
  onSearchChange: (query: string) => void;
  onToggleContactSelection: (stageId: string, contactId: string) => void;
  onRemoveSelected: () => void;
  onAddTag: () => void;
  onPageChange: (page: number) => void;
}

export const PipelineStageCard = memo(function PipelineStageCard({
  stage,
  isSelected,
  selectedContacts,
  searchQuery,
  currentPage,
  totalPages,
  onToggleSelection,
  onSearchChange,
  onToggleContactSelection,
  onRemoveSelected,
  onAddTag,
  onPageChange,
}: PipelineStageCardProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });

  const toggleSelectAll = () => {
    if (selectedContacts.size === stage.contacts.length) {
      // Deselect all
      stage.contacts.forEach((contact) => {
        if (selectedContacts.has(contact.id)) {
          onToggleContactSelection(stage.id, contact.id);
        }
      });
    } else {
      // Select all
      stage.contacts.forEach((contact) => {
        if (!selectedContacts.has(contact.id)) {
          onToggleContactSelection(stage.id, contact.id);
        }
      });
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-80 transition-colors ${
        isOver ? 'opacity-50' : ''
      }`}
    >
      <Card className={`h-full ${isSelected ? 'ring-2 ring-primary' : ''}`}>
        <CardHeader
          className="pb-3 border-t-2"
          style={{ borderTopColor: stage.color }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={isSelected}
                onCheckedChange={onToggleSelection}
              />
              <CardTitle className="text-base">{stage.name}</CardTitle>
            </div>
            <Badge variant="secondary">{stage._count.contacts}</Badge>
          </div>

          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-7 h-8 text-sm"
            />
          </div>

          {selectedContacts.size > 0 && (
            <div className="flex items-center gap-1 pt-2">
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-xs flex-1"
                onClick={onRemoveSelected}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Remove ({selectedContacts.size})
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs flex-1"
                onClick={onAddTag}
              >
                <TagIcon className="h-3 w-3 mr-1" />
                Tag
              </Button>
            </div>
          )}

          {stage.contacts.length > 0 && (
            <div className="flex items-center gap-2 pt-2">
              <Checkbox
                checked={selectedContacts.size === stage.contacts.length}
                onCheckedChange={toggleSelectAll}
                id={`select-all-${stage.id}`}
              />
              <label
                htmlFor={`select-all-${stage.id}`}
                className="text-xs cursor-pointer"
              >
                Select All
              </label>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
          {stage.contacts.map((contact) => (
            <div key={contact.id} className="flex items-start gap-2">
              <Checkbox
                checked={selectedContacts.has(contact.id)}
                onCheckedChange={() => onToggleContactSelection(stage.id, contact.id)}
                className="mt-3"
              />
              <div className="flex-1">
                <Link href={`/contacts/${contact.id}`}>
                  <ContactCard contact={contact} />
                </Link>
              </div>
            </div>
          ))}

          {stage.contacts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {searchQuery ? 'No contacts found' : 'No contacts in this stage'}
            </p>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

