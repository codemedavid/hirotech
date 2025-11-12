'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, Info } from 'lucide-react';
import { toast } from 'sonner';

interface Stage {
  id: string;
  name: string;
  leadScoreMin: number;
  leadScoreMax: number;
  type: string;
  order: number;
}

interface ScoreRangeDialogProps {
  stages: Stage[];
  pipelineId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function ScoreRangeDialog({
  stages,
  pipelineId,
  open,
  onOpenChange,
  onSaved,
}: ScoreRangeDialogProps) {
  const [stageRanges, setStageRanges] = useState<Stage[]>(stages);
  const [isSaving, setIsSaving] = useState(false);

  const updateStageRange = (stageId: string, field: 'min' | 'max', value: string) => {
    const numValue = parseInt(value) || 0;
    const clampedValue = Math.max(0, Math.min(100, numValue));

    setStageRanges(prev =>
      prev.map(stage =>
        stage.id === stageId
          ? {
              ...stage,
              [field === 'min' ? 'leadScoreMin' : 'leadScoreMax']: clampedValue,
            }
          : stage
      )
    );
  };

  const autoGenerate = async () => {
    try {
      const response = await fetch(`/api/pipelines/${pipelineId}/analyze-stages`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to auto-generate');

      const data = await response.json();

      // Update local state with generated ranges
      if (data.distribution?.stages) {
        const updatedRanges = stageRanges.map(stage => {
          const generated = data.distribution.stages.find((s: any) => s.name === stage.name);
          if (generated) {
            const [min, max] = generated.scoreRange.split('-').map((n: string) => parseInt(n));
            return { ...stage, leadScoreMin: min, leadScoreMax: max };
          }
          return stage;
        });
        setStageRanges(updatedRanges);
        toast.success('Score ranges auto-generated!');
      }
    } catch (error) {
      console.error('Auto-generate error:', error);
      toast.error('Failed to auto-generate ranges');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      // 1. Save score ranges
      const response = await fetch(`/api/pipelines/${pipelineId}/stages/update-ranges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stageRanges: stageRanges.map(s => ({
            stageId: s.id,
            leadScoreMin: s.leadScoreMin,
            leadScoreMax: s.leadScoreMax,
          })),
        }),
      });

      if (!response.ok) throw new Error('Failed to save ranges');

      // 2. Re-assign all contacts based on new ranges
      const reassignResponse = await fetch(`/api/pipelines/${pipelineId}/reassign-all`, {
        method: 'POST',
      });

      if (!reassignResponse.ok) throw new Error('Failed to re-assign contacts');

      const reassignData = await reassignResponse.json();

      toast.success(
        `Score ranges saved! Re-assigned ${reassignData.reassigned} of ${reassignData.total} contacts.`
      );

      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save score ranges');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Lead Score Ranges</DialogTitle>
          <DialogDescription>
            Set score ranges for each stage. Contacts will be automatically assigned to stages
            based on their lead score. Click &quot;Auto-Generate&quot; for intelligent defaults.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">How score ranges work:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>LEAD stages typically use 0-30 (cold to warm leads)</li>
                <li>IN_PROGRESS stages use 31-80 (qualified to closing)</li>
                <li>WON stages use 81-100 (hot leads and closed deals)</li>
                <li>LOST stages use 0-20 (lost opportunities)</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex justify-end mb-4">
          <Button onClick={autoGenerate} variant="outline" size="sm">
            <Sparkles className="mr-2 h-4 w-4" />
            Auto-Generate All Ranges
          </Button>
        </div>

        <div className="space-y-3">
          {stageRanges.map((stage, index) => (
            <div
              key={stage.id}
              className="border rounded-lg p-4 hover:border-blue-300 transition-colors"
            >
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    #{index + 1}
                  </span>
                  <span className="font-medium">{stage.name}</span>
                  <span className="text-xs px-2 py-1 bg-slate-100 rounded">
                    {stage.type}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`min-${stage.id}`} className="text-xs">
                    Minimum Score
                  </Label>
                  <Input
                    id={`min-${stage.id}`}
                    type="number"
                    min="0"
                    max="100"
                    value={stage.leadScoreMin}
                    onChange={e => updateStageRange(stage.id, 'min', e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor={`max-${stage.id}`} className="text-xs">
                    Maximum Score
                  </Label>
                  <Input
                    id={`max-${stage.id}`}
                    type="number"
                    min="0"
                    max="100"
                    value={stage.leadScoreMax}
                    onChange={e => updateStageRange(stage.id, 'max', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="mt-2 text-xs text-muted-foreground">
                Contacts with scores {stage.leadScoreMin}-{stage.leadScoreMax} will be
                assigned to this stage
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save & Re-assign Contacts'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

