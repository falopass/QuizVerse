'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils/cn';

export interface LivePlayersProps {
  quizId?: string;
  className?: string;
}

export function LivePlayers({ quizId, className }: LivePlayersProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();

    // Subscribe to presence channel for live players
    const channel = supabase.channel('live-players', {
      config: {
        presence: {
          key: quizId || 'global',
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const key = quizId || 'global';
        setCount(state[key]?.length || 0);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            onlineAt: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [quizId]);

  if (count === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium',
        'bg-bg-tertiary border border-border-subtle',
        className
      )}
    >
      {/* Pulsing dot */}
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
      </span>
      <span className="text-text-secondary">
        {count} {count === 1 ? 'person' : 'people'} playing now
      </span>
    </motion.div>
  );
}

export default LivePlayers;
