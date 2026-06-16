'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cleanCPF } from '@/domain/validators/cpf';

type Props = {
  sessionId: string;
  onClose: () => void;
};

const REASONS = [
  { value: 'sem_celular', label: 'Morador sem celular' },
  { value: 'idoso', label: 'Morador idoso' },
  { value: 'portador_necessidades', label: 'Portador de necessidades especiais' },
  { value: 'outro', label: 'Outro' },
] as const;

export function ManualConfirmationForm({ sessionId, onClose }: Props) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [cpf, setCpf] = useState('');
  const [confirmedBy, setConfirmedBy] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason || !confirmedBy) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/retirada/${sessionId}/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manualReason: reason,
          doormanNote: note || null,
          confirmedBy,
          cpf: cleanCPF(cpf) || null,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onClose();
        router.refresh();
      } else {
        setError(data.error ?? 'Erro ao confirmar.');
      }
    } catch {
      setError('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-xl border border-border bg-bg-primary p-6 shadow-lg">
        <h2 className="text-sm font-semibold text-text-primary">Confirmação Manual</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label htmlFor="manual-porteiro" className="mb-1 block text-xs font-medium text-text-secondary">Identificação do Porteiro *</label>
            <input
              id="manual-porteiro"
              type="text"
              value={confirmedBy}
              onChange={(e) => setConfirmedBy(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="manual-motivo" className="mb-1 block text-xs font-medium text-text-secondary">Motivo *</label>
            <select
              id="manual-motivo"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
            >
              <option value="">Selecione...</option>
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="manual-cpf" className="mb-1 block text-xs font-medium text-text-secondary">CPF do Morador</label>
            <input
              id="manual-cpf"
              type="text"
              value={cpf}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                let f = digits;
                if (digits.length > 9) f = `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
                else if (digits.length > 6) f = `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6)}`;
                else if (digits.length > 3) f = `${digits.slice(0,3)}.${digits.slice(3)}`;
                setCpf(f);
              }}
              maxLength={14}
              placeholder="000.000.000-00"
              className="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="manual-obs" className="mb-1 block text-xs font-medium text-text-secondary">Observação</label>
            <textarea
              id="manual-obs"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
            />
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {loading ? 'Confirmando...' : 'Confirmar'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-tertiary"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
