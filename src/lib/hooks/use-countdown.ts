'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, useCallback } from 'react';

interface UseCountdownProps {
  initialSeconds: number;
  onComplete?: () => void;
  autoStart?: boolean;
}

export function useCountdown({ initialSeconds, onComplete, autoStart = true }: UseCountdownProps) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(autoStart);
  const [isPaused, setIsPaused] = useState(false);

   
  useEffect(() => {
    if (!isRunning || isPaused) return;

    if (seconds <= 0) {
      onComplete?.();
      setIsRunning(false);
      return;
    }

    const interval = setInterval(() => {
      setSeconds((s) => s - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, isPaused, seconds, onComplete]);

  const start = useCallback(() => {
    setIsRunning(true);
    setIsPaused(false);
  }, []);

  const pause = useCallback(() => {
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    setIsPaused(false);
  }, []);

  const stop = useCallback(() => {
    setIsRunning(false);
    setSeconds(initialSeconds);
  }, [initialSeconds]);

  const reset = useCallback(() => {
    setSeconds(initialSeconds);
    setIsRunning(autoStart);
    setIsPaused(false);
  }, [initialSeconds, autoStart]);

  const formatTime = useCallback(() => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, [seconds]);

  return {
    seconds,
    isRunning,
    isPaused,
    formatTime,
    start,
    pause,
    resume,
    stop,
    reset,
  };
}

export default useCountdown;
