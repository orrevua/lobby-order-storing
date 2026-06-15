'use client';

import { useEffect, useRef } from 'react';

export function useRealtimeSession(sessionId: string, onConfirmed: () => void) {
  const callbackRef = useRef(onConfirmed);
  callbackRef.current = onConfirmed;
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;

    const poll = setInterval(async () => {
      if (firedRef.current) return;
      try {
        const res = await fetch(`/api/retirada/${sessionId}`);
        const data = await res.json();
        if (data.status === 'confirmed') {
          firedRef.current = true;
          clearInterval(poll);
          callbackRef.current();
        }
      } catch { /* ignore */ }
    }, 2000);

    return () => clearInterval(poll);
  }, [sessionId]);
}
