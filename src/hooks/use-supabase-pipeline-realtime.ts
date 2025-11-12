import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface PipelineUpdate {
  type: 'contact_changed' | 'stage_changed';
  timestamp: number;
}

/**
 * Supabase Realtime hook for pipeline updates
 * Listens to Contact table changes and triggers UI updates
 * NO POLLING - Event-driven, instant updates
 */
export function useSupabasePipelineRealtime(pipelineId: string) {
  const [updateSignal, setUpdateSignal] = useState<PipelineUpdate | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const supabase = createClient();

    console.log(`[Supabase Realtime] Subscribing to pipeline ${pipelineId}...`);

    // Subscribe to Contact changes for this pipeline
    const contactChannel = supabase
      .channel(`pipeline-${pipelineId}-contacts`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'Contact',
          filter: `pipelineId=eq.${pipelineId}`
        },
        (payload) => {
          console.log('[Supabase Realtime] Contact changed:', payload.eventType);
          setUpdateSignal({
            type: 'contact_changed',
            timestamp: Date.now()
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Supabase Realtime] Successfully subscribed to pipeline updates');
          setIsSubscribed(true);
          setError(null);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Supabase Realtime] Subscription error');
          setError(new Error('Failed to subscribe to realtime updates'));
          setIsSubscribed(false);
        } else if (status === 'TIMED_OUT') {
          console.error('[Supabase Realtime] Subscription timed out');
          setError(new Error('Subscription timed out'));
          setIsSubscribed(false);
        } else {
          console.log('[Supabase Realtime] Status:', status);
        }
      });

    // Cleanup on unmount
    return () => {
      console.log('[Supabase Realtime] Unsubscribing from pipeline updates...');
      supabase.removeChannel(contactChannel);
      setIsSubscribed(false);
    };
  }, [pipelineId]); // Only re-subscribe if pipelineId changes (stable!)

  return { 
    updateSignal, 
    isSubscribed,
    error
  };
}

