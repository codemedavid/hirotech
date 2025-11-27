import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface PipelineUpdate {
  type: 'contact_changed' | 'pipeline_changed' | 'stage_changed' | 'automation_changed';
  timestamp: number;
  pipelineId?: string; // For filtering
}

interface Contact {
  id: string;
  pipelineId?: string;
  [key: string]: unknown;
}

/**
 * Supabase Realtime hook for pipeline updates
 * Listens to Pipeline, PipelineStage, PipelineAutomation, and Contact table changes
 * NO POLLING - Event-driven, instant updates
 */
export function useSupabasePipelineRealtime(pipelineId: string) {
  const [updateSignal, setUpdateSignal] = useState<PipelineUpdate | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const supabase = createClient();

    console.log(`[Supabase Realtime] Subscribing to pipeline ${pipelineId}...`);

    // Use a single channel for all table subscriptions
    const channel = supabase
      .channel(`pipeline-${pipelineId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Pipeline',
          filter: `id=eq.${pipelineId}`
        },
        (payload) => {
          console.log('[Supabase Realtime] Pipeline changed:', payload.eventType);
          setUpdateSignal({
            type: 'pipeline_changed',
            timestamp: Date.now(),
            pipelineId
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'PipelineStage',
          filter: `pipelineId=eq.${pipelineId}`
        },
        (payload) => {
          console.log('[Supabase Realtime] Stage changed:', payload.eventType);
          setUpdateSignal({
            type: 'stage_changed',
            timestamp: Date.now(),
            pipelineId
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'PipelineAutomation',
          filter: `pipelineId=eq.${pipelineId}`
        },
        (payload) => {
          console.log('[Supabase Realtime] Automation changed:', payload.eventType);
          setUpdateSignal({
            type: 'automation_changed',
            timestamp: Date.now(),
            pipelineId
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Contact',
          filter: `pipelineId=eq.${pipelineId}`
        },
        (payload: RealtimePostgresChangesPayload<Contact>) => {
          console.log('[Supabase Realtime] Contact changed:', payload.eventType);
          setUpdateSignal({
            type: 'contact_changed',
            timestamp: Date.now(),
            pipelineId
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Supabase Realtime] Successfully subscribed to pipeline updates');
          setIsSubscribed(true);
          setError(null);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.error(`[Supabase Realtime] Subscription error: ${status}`);
          setError(new Error(`Failed to subscribe to realtime updates: ${status}`));
          setIsSubscribed(false);
        } else {
          console.log(`[Supabase Realtime] Subscription status: ${status}`);
        }
      });

    // Cleanup on unmount
    return () => {
      console.log('[Supabase Realtime] Unsubscribing from pipeline updates...');
      supabase.removeChannel(channel);
      setIsSubscribed(false);
    };
  }, [pipelineId]);

  return { 
    updateSignal, 
    isSubscribed,
    error
  };
}

