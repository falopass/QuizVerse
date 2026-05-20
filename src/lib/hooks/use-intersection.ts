'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

interface UseIntersectionOptions {
  threshold?: number | number[];
  rootMargin?: string;
  triggerOnce?: boolean;
}

export function useIntersection<T extends HTMLElement>({
  threshold = 0,
  rootMargin = '0px',
  triggerOnce = true,
}: UseIntersectionOptions = {}) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const elementRef = useRef<T>(null);
  const hasTriggered = useRef(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isNowIntersecting = entry.isIntersecting;

        if (triggerOnce) {
          if (isNowIntersecting && !hasTriggered.current) {
            setIsIntersecting(true);
            hasTriggered.current = true;
            observer.unobserve(element);
          }
        } else {
          setIsIntersecting(isNowIntersecting);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [threshold, rootMargin, triggerOnce]);

  const ref = useCallback((node: T | null) => {
    if (elementRef.current) {
      // Clean up old observer
    }
    elementRef.current = node;
  }, []);

  return { ref, elementRef, isIntersecting };
}

export default useIntersection;
