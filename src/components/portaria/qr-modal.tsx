'use client';

import { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useRouter } from 'next/navigation';
import { useRealtimeSession } from '@/infrastructure/supabase/use-realtime-session';

type Props = {
  sessionId: string;
  expiresAt: string;
  qrCodeUrl: string;
  onClose: () => void;
  onManual: () => void;
};

export function QrModal({ sessionId, expiresAt, qrCodeUrl, onClose, onManual }: Props) {
  const router = useRouter();
  const [state, setState] = useState<'waiting' | 'confirmed' | 'expired'>('waiting');
  const [remaining, setRemaining] = useState(() => {
    return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  });

  useEffect(() => {
    if (state !== 'waiting') return;
    const timer = setInterval(() => {
      const secs = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setRemaining(secs);
      if (secs <= 0) {
        setState('expired');
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, state]);

  const handleConfirmed = useCallback(() => {
    setState('confirmed');
    setTimeout(() => {
      onClose();
      router.refresh();
    }, 2000);
  }, [onClose, router]);

  useRealtimeSession(sessionId, handleConfirmed);

  async function handleCancel() {
    await fetch(`/api/retirada/${sessionId}/cancelar`, { method: 'POST' });
    onClose();
    router.refresh();
  }

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-xl border border-border bg-bg-primary p-6 shadow-lg">
        {state === 'confirmed' ? (
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
              <svg className="h-7 w-7 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-lg font-semibold text-success">Retirada confirmada pelo morador!</p>
          </div>
        ) : state === 'expired' ? (
          <div className="text-center">
            <p className="text-lg font-medium text-text-primary">Sessão expirada</p>
            <p className="mt-2 text-sm text-text-tertiary">Gere um novo QR code para continuar.</p>
            <button onClick={onClose} className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">
              Fechar
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">QR Code de Retirada</h2>
              <span className="text-sm font-medium text-text-secondary">
                {minutes}:{seconds.toString().padStart(2, '0')}
              </span>
            </div>
            <div className="mt-4 flex justify-center rounded-lg bg-white p-4">
              <QRCodeSVG value={qrCodeUrl} size={200} />
            </div>
            <p className="mt-3 text-center text-xs text-text-tertiary">
              Peça ao morador para escanear com a câmera do celular
            </p>
            <div className="mt-4 flex gap-2">
              <button onClick={onManual} className="flex-1 rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-tertiary">
                Confirmação Manual
              </button>
              <button onClick={handleCancel} className="flex-1 rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-tertiary">
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
