'use client';

import { useState } from 'react';
import { deleteResident } from '@/lib/actions/residents';
import { MoradorForm } from './morador-form';
import type { Morador } from '@/domain/entities';
import type { Apartamento } from '@/domain/entities';

type MoradorComApartamento = Morador & { apartamento: Apartamento | null };

type Props = {
  moradores: MoradorComApartamento[];
  apartamentos: Apartamento[];
};

export function MoradorList({ moradores, apartamentos }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  async function handleDelete(id: number) {
    setError(null);
    const result = await deleteResident(id);
    if (!result.success) setError(result.error);
  }

  if (moradores.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-text-tertiary">
        Nenhum morador cadastrado.
      </p>
    );
  }

  return (
    <div>
      {error && <p className="mb-4 text-sm text-error">{error}</p>}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-bg-secondary">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Nome</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Contato</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Apartamento</th>
              <th className="px-4 py-3 text-right font-medium text-text-secondary">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bg-tertiary">
            {moradores.map((morador) =>
              editingId === morador.id ? (
                <tr key={morador.id}>
                  <td colSpan={4} className="p-4">
                    <MoradorForm
                      apartamentos={apartamentos}
                      morador={morador}
                      onClose={() => setEditingId(null)}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={morador.id} className="hover:bg-bg-secondary">
                  <td className="px-4 py-3 text-text-primary">{morador.nome}</td>
                  <td className="px-4 py-3 text-text-primary">{morador.contato || '—'}</td>
                  <td className="px-4 py-3 text-text-primary">
                    {morador.apartamento
                      ? `Bloco ${morador.apartamento.bloco} - Apt ${morador.apartamento.numero}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(morador.id)}
                        className="rounded px-2 py-1 text-xs font-medium text-accent hover:bg-accent-muted"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(morador.id)}
                        className="rounded px-2 py-1 text-xs font-medium text-error hover:bg-error/10"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
