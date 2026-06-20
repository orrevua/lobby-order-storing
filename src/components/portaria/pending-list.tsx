'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { EncomendaComMorador } from '@/domain/entities';
import { QrModal } from './qr-modal';
import { ManualConfirmationForm } from './manual-confirmation-form';

type Props = {
  encomendas: EncomendaComMorador[];
};

type SessionData = {
  sessionId: string;
  expiresAt: string;
  qrCodeUrl: string;
};

type GroupedEncomendas = {
  apartamentoId: number;
  label: string;
  items: EncomendaComMorador[];
};

function groupByApartamento(encomendas: EncomendaComMorador[]): GroupedEncomendas[] {
  const map = new Map<number, GroupedEncomendas>();
  for (const enc of encomendas) {
    const ap = enc.morador.apartamento;
    if (!ap) continue;
    let group = map.get(ap.id);
    if (!group) {
      group = { apartamentoId: ap.id, label: `Bloco ${ap.bloco} - Apt ${ap.numero}`, items: [] };
      map.set(ap.id, group);
    }
    group.items.push(enc);
  }
  return Array.from(map.values());
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function PendingList({ encomendas }: Props) {
  const [selected, setSelected] = useState<{ apartamentoId: number; ids: Set<number> } | null>(null);
  const [session, setSession] = useState<SessionData | null>(null);
  const [manualSessionId, setManualSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedIds, setConfirmedIds] = useState<Set<number>>(new Set());
  const router = useRouter();

  const handleSessionConfirmed = useCallback(() => {
    if (selected) {
      setConfirmedIds(new Set(selected.ids));
    }
    setSession(null);
    setSelected(null);
    setTimeout(() => {
      setConfirmedIds(new Set());
      router.refresh();
    }, 2000);
  }, [selected, router]);

  const groups = groupByApartamento(encomendas);

  if (groups.length === 0) {
    return <p className="py-8 text-center text-sm text-text-tertiary">Nenhuma encomenda pendente.</p>;
  }

  function toggleItem(apartamentoId: number, encomendaId: number) {
    setSelected((prev) => {
      if (!prev || prev.apartamentoId !== apartamentoId) {
        return { apartamentoId, ids: new Set([encomendaId]) };
      }
      const next = new Set(prev.ids);
      if (next.has(encomendaId)) next.delete(encomendaId);
      else next.add(encomendaId);
      return next.size === 0 ? null : { apartamentoId, ids: next };
    });
  }

  function toggleAll(apartamentoId: number, items: EncomendaComMorador[]) {
    setSelected((prev) => {
      if (prev?.apartamentoId === apartamentoId && prev.ids.size === items.length) return null;
      return { apartamentoId, ids: new Set(items.map((e) => e.id)) };
    });
  }

  async function handleGenerateQr() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/retirada/sessao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apartamentoId: selected.apartamentoId,
          encomendaIds: Array.from(selected.ids),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSession(data.data);
      } else {
        setError(data.error ?? 'Erro ao gerar sessão.');
      }
    } catch {
      setError('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  }

  async function handleManualDirect() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/retirada/sessao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apartamentoId: selected.apartamentoId,
          encomendaIds: Array.from(selected.ids),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setManualSessionId(data.data.sessionId);
      } else {
        setError(data.error ?? 'Erro ao gerar sessão.');
      }
    } catch {
      setError('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">
          Encomendas Pendentes ({encomendas.length})
        </h3>
        {selected && (
          <div className="flex gap-2">
            <button
              onClick={handleGenerateQr}
              disabled={loading}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {loading ? 'Gerando...' : `Gerar QR Code (${selected.ids.size})`}
            </button>
            <button
              onClick={handleManualDirect}
              disabled={loading}
              className="rounded-lg border border-border bg-bg-secondary px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-bg-tertiary disabled:opacity-50"
            >
              Confirmação Manual
            </button>
          </div>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-error">{error}</p>}

      <div className="space-y-4">
        {groups.map((group) => {
          const isGroupSelected = selected?.apartamentoId === group.apartamentoId;
          const allChecked = isGroupSelected && selected.ids.size === group.items.length;

          return (
            <div key={group.apartamentoId} className="rounded-lg border border-border">
              <div className="flex items-center gap-3 bg-bg-secondary px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={() => toggleAll(group.apartamentoId, group.items)}
                  className="h-4 w-4 accent-accent"
                />
                <span className="text-sm font-medium text-text-primary">{group.label}</span>
                <span className="text-xs text-text-tertiary">({group.items.length})</span>
              </div>
              <div className="divide-y divide-bg-tertiary">
                {group.items.map((enc) => {
                  const checked = isGroupSelected && selected.ids.has(enc.id);
                  return (
                    <label
                      key={enc.id}
                      className={`flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-bg-secondary transition-all duration-700 ${confirmedIds.has(enc.id) ? 'opacity-40 bg-success/5' : ''}`}
                    >
                      {confirmedIds.has(enc.id) ? (
                        <svg className="h-4 w-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleItem(group.apartamentoId, enc.id)}
                          className="h-4 w-4 accent-accent"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary">{enc.morador.nome}</p>
                        <p className="text-xs text-text-tertiary">
                          {enc.descricao ?? 'Encomenda'}
                          {enc.codigoRastreio ? ` • ${enc.codigoRastreio}` : ''}
                          {' • '}{formatDate(enc.dataChegada)}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {session && (
        <QrModal
          sessionId={session.sessionId}
          expiresAt={session.expiresAt}
          qrCodeUrl={session.qrCodeUrl}
          onClose={() => { setSession(null); setSelected(null); }}
          onConfirmed={handleSessionConfirmed}
          onManual={() => { setManualSessionId(session.sessionId); setSession(null); }}
        />
      )}

      {manualSessionId && (
        <ManualConfirmationForm
          sessionId={manualSessionId}
          onClose={() => { setManualSessionId(null); setSelected(null); }}
        />
      )}
    </div>
  );
}
