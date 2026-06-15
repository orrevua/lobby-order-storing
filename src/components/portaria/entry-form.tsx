"use client";

import { useState, useTransition, useRef } from "react";
import { registerPackage } from "@/lib/actions/packages";
import type { Apartamento, Morador } from "@/domain/entities";

type Props = {
  apartamentos: Apartamento[];
};

export function EntryForm({ apartamentos }: Props) {
  const [selectedBloco, setSelectedBloco] = useState("");
  const [selectedAptId, setSelectedAptId] = useState("");
  const [moradores, setMoradores] = useState<Morador[]>([]);
  const [loadingMoradores, setLoadingMoradores] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const blocos = [...new Set(apartamentos.map((a) => a.bloco))].sort();
  const filteredApts = apartamentos.filter((a) => a.bloco === selectedBloco);

  function handleBlocoChange(bloco: string) {
    setSelectedBloco(bloco);
    setSelectedAptId("");
    setMoradores([]);
  }

  async function handleAptChange(aptId: string) {
    setSelectedAptId(aptId);
    setMoradores([]);
    if (!aptId) return;

    setLoadingMoradores(true);
    try {
      const res = await fetch(`/api/moradores?apartamento_id=${aptId}`);
      const data = await res.json();
      setMoradores(data);
    } catch {
      setMoradores([]);
    } finally {
      setLoadingMoradores(false);
    }
  }

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await registerPackage(formData);
      if (!result.success) {
        setError(result.error);
      } else {
        setSuccess(true);
        formRef.current?.reset();
        setSelectedBloco("");
        setSelectedAptId("");
        setMoradores([]);
        setTimeout(() => setSuccess(false), 3000);
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="rounded-lg border border-border bg-bg-secondary p-4">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">Nova Encomenda</h3>

      {error && <p className="mb-3 text-sm text-error">{error}</p>}
      {success && <p className="mb-3 text-sm text-success">Encomenda registrada com sucesso!</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-text-secondary">Bloco *</label>
          <select
            value={selectedBloco}
            onChange={(e) => handleBlocoChange(e.target.value)}
            required
            className="w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">Selecione...</option>
            {blocos.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-secondary">Apartamento *</label>
          <select
            value={selectedAptId}
            onChange={(e) => handleAptChange(e.target.value)}
            required
            disabled={!selectedBloco}
            className="w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
          >
            <option value="">Selecione...</option>
            {filteredApts.map((a) => (
              <option key={a.id} value={a.id}>Apt {a.numero}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-secondary">Morador *</label>
          <select
            name="morador_id"
            required
            disabled={moradores.length === 0}
            className="w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
          >
            <option value="">{loadingMoradores ? "Carregando..." : "Selecione..."}</option>
            {moradores.map((m) => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-secondary">Código de Rastreio</label>
          <input
            type="text"
            name="codigo_rastreio"
            className="w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-secondary">Descrição</label>
          <input
            type="text"
            name="descricao"
            placeholder="Ex: Caixa grande, Envelope..."
            className="w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-secondary">Porteiro *</label>
          <input
            type="text"
            name="received_by"
            required
            placeholder="Nome do porteiro"
            className="w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>

      <div className="mt-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-accent px-6 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Registrando..." : "Registrar Encomenda"}
        </button>
      </div>
    </form>
  );
}
