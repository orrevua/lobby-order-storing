"use client";

import { useState, useTransition } from "react";
import {
  createApartment,
  updateApartment,
} from "@/lib/actions/apartments";
import type { Apartamento } from "@/domain/entities";

type Props = {
  apartamento?: Apartamento;
  onClose?: () => void;
};

export function ApartamentoForm({ apartamento, onClose }: Props) {
  const isEdit = !!apartamento;
  const [bloco, setBloco] = useState(apartamento?.bloco ?? "");
  const [numero, setNumero] = useState(apartamento?.numero ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = isEdit
        ? await updateApartment(apartamento.id, formData)
        : await createApartment(formData);

      if (!result.success) {
        setError(result.error);
        return;
      }

      if (isEdit) {
        onClose?.();
      } else {
        setBloco("");
        setNumero("");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-bg-secondary p-4">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">
        {isEdit ? "Editar Apartamento" : "Novo Apartamento"}
      </h3>
      {error && (
        <p className="mb-3 text-sm text-error" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`bloco-${apartamento?.id ?? "new"}`}
            className="text-sm font-medium text-text-secondary"
          >
            Bloco
          </label>
          <input
            id={`bloco-${apartamento?.id ?? "new"}`}
            name="bloco"
            type="text"
            required
            value={bloco}
            onChange={(e) => setBloco(e.target.value)}
            className="rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor={`numero-${apartamento?.id ?? "new"}`}
            className="text-sm font-medium text-text-secondary"
          >
            Número
          </label>
          <input
            id={`numero-${apartamento?.id ?? "new"}`}
            name="numero"
            type="text"
            required
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            className="rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        <div className="flex items-end gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Salvando..." : "Salvar"}
          </button>

          {isEdit && onClose && (
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
      </div>
    </form>
  );
}
