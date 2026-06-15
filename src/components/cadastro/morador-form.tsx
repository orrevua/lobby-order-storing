"use client";

import { useState, useTransition, useEffect } from "react";
import { createResident, updateResident } from "@/lib/actions/residents";
import { formatCPF } from "@/domain/validators/cpf";
import type { Morador } from "@/domain/entities";
import type { Apartamento } from "@/domain/entities";

type Props = {
  apartamentos: Apartamento[];
  morador?: Morador;
  onClose?: () => void;
};

export function MoradorForm({ apartamentos, morador, onClose }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [existingSignatureUrl, setExistingSignatureUrl] = useState<string | null>(null);

  useEffect(() => {
    if (morador?.signatureUrl) {
      fetch(`/api/moradores/${morador.id}/assinatura`)
        .then((r) => r.json())
        .then((d) => { if (d.signedUrl) setExistingSignatureUrl(d.signedUrl); })
        .catch(() => {});
    }
  }, [morador?.id, morador?.signatureUrl]);

  async function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = morador
        ? await updateResident(morador.id, formData)
        : await createResident(formData);

      if (!result.success) {
        setError(result.error);
      } else if (onClose) {
        onClose();
      }
    });
  }

  return (
    <form action={handleSubmit} className="rounded-lg border border-border bg-bg-secondary p-4">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">
        {morador ? "Editar Morador" : "Novo Morador"}
      </h3>
      {error && (
        <p className="mb-3 text-sm text-error" role="alert">
          {error}
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="nome" className="text-sm font-medium text-text-secondary">
            Nome *
          </label>
          <input
            type="text"
            id="nome"
            name="nome"
            defaultValue={morador?.nome ?? ""}
            required
            className="rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="contato" className="text-sm font-medium text-text-secondary">
            Contato
          </label>
          <input
            type="text"
            id="contato"
            name="contato"
            defaultValue={morador?.contato ?? ""}
            className="rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="cpf" className="text-sm font-medium text-text-secondary">
            CPF
          </label>
          <input
            type="text"
            id="cpf"
            name="cpf"
            maxLength={14}
            placeholder="000.000.000-00"
            defaultValue={morador?.cpf ? formatCPF(morador.cpf) : ""}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
              let formatted = digits;
              if (digits.length > 9) formatted = `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
              else if (digits.length > 6) formatted = `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6)}`;
              else if (digits.length > 3) formatted = `${digits.slice(0,3)}.${digits.slice(3)}`;
              e.target.value = formatted;
            }}
            className="rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="apartamento_id" className="text-sm font-medium text-text-secondary">
            Apartamento *
          </label>
          <select
            id="apartamento_id"
            name="apartamento_id"
            defaultValue={morador?.apartamentoId ?? ""}
            required
            className="rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">Selecione...</option>
            {apartamentos.map((apt) => (
              <option key={apt.id} value={apt.id}>
                Bloco {apt.bloco} - Apt {apt.numero}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-sm font-medium text-text-secondary">Assinatura</label>
        <div className="block gap-4">
          {(signaturePreview || existingSignatureUrl) && (
            <img
              src={signaturePreview || existingSignatureUrl!}
              alt="Assinatura"
              className="h-20 w-auto rounded border border-border object-contain"
            />
          )}
          <div className="flex flex-col gap-1">
            <input
              type="file"
              name="signature"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setSignaturePreview(URL.createObjectURL(file));
                } else {
                  setSignaturePreview(null);
                }
              }}
              className="text-sm text-text-secondary file:mr-2 file:rounded file:border-0 file:bg-accent/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-accent"
            />
            <span className="text-xs text-text-tertiary">Tire uma foto da assinatura ou selecione um arquivo</span>
          </div>
        </div>
        {morador?.signatureUrl && (
          <input type="hidden" name="existing_signature_url" value={morador.signatureUrl} />
        )}
      </div>

      <div className="mt-3 flex items-end gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Salvando..." : "Salvar"}
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-md border border-border bg-bg-primary px-4 py-2 text-sm font-medium text-text-secondary shadow-sm transition-colors hover:bg-bg-tertiary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
