"use client";

import Link from "next/link";
import { useState } from "react";
import type { EncomendaComMorador } from "@/domain/entities";
import { formatCPF } from "@/domain/validators/cpf";

type Props = {
  encomendas: EncomendaComMorador[];
  total: number;
  page: number;
  perPage: number;
  searchParams: Record<string, string>;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const delivered = status === "retirada" || status === "entregue";
  const label = status === "entregue" ? "Entregue" : status === "retirada" ? "Retirada" : "Pendente";
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
        delivered
          ? "bg-success/15 text-success"
          : "bg-warning/15 text-warning"
      }`}
    >
      {label}
    </span>
  );
}

function SignatureButton({ moradorId }: { moradorId: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (url) { setUrl(null); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/moradores/${moradorId}/assinatura`);
      const data = await res.json();
      if (data.signedUrl) setUrl(data.signedUrl);
    } catch { /* ignore */ }
    setLoading(false);
  }

  return (
    <div>
      <button
        onClick={handleClick}
        className="text-xs text-accent underline hover:text-accent-hover"
      >
        {loading ? "..." : url ? "Ocultar" : "Ver assinatura"}
      </button>
      {url && <img src={url} alt="Assinatura" className="mt-1 h-16 w-auto rounded border border-border object-contain" />}
    </div>
  );
}

function buildPageUrl(searchParams: Record<string, string>, page: number): string {
  const params = new URLSearchParams(searchParams);
  params.set("page", String(page));
  return `/consulta?${params.toString()}`;
}

export function ResultsTable({ encomendas, total, page, perPage, searchParams }: Props) {
  const totalPages = Math.ceil(total / perPage);

  if (encomendas.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-text-tertiary">
        Nenhuma encomenda encontrada.
      </p>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-bg-secondary">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Morador</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">CPF</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Apartamento</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Código Rastreio</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Descrição</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Assinatura</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Recebido por</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Data Chegada</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Data Retirada</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bg-tertiary">
            {encomendas.map((enc) => (
              <tr key={enc.id} className="hover:bg-bg-secondary">
                <td className="px-4 py-3 text-text-primary">{enc.morador.nome}</td>
                <td className="px-4 py-3 text-text-tertiary text-xs">{enc.morador.cpf ? formatCPF(enc.morador.cpf) : "—"}</td>
                <td className="px-4 py-3 text-text-primary">
                  {enc.morador.apartamento
                    ? `Bloco ${enc.morador.apartamento.bloco} - Apt ${enc.morador.apartamento.numero}`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-text-primary">{enc.codigoRastreio || "—"}</td>
                <td className="px-4 py-3 text-text-primary">{enc.descricao || "—"}</td>
                <td className="px-4 py-3">
                  {enc.morador.signatureUrl ? <SignatureButton moradorId={enc.morador.id} /> : <span className="text-text-tertiary">—</span>}
                </td>
                <td className="px-4 py-3 text-text-primary">{enc.receivedBy || "—"}</td>
                <td className="px-4 py-3 text-text-primary">{formatDate(enc.dataChegada)}</td>
                <td className="px-4 py-3 text-text-primary">{formatDate(enc.dataRetirada)}</td>
                <td className="px-4 py-3"><StatusBadge status={enc.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-text-secondary">
        <span>
          Mostrando {(page - 1) * perPage + 1}&ndash;{Math.min(page * perPage, total)} de {total}
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              href={buildPageUrl(searchParams, page - 1)}
              className="rounded border border-border px-3 py-1 text-text-primary transition-colors hover:bg-bg-secondary"
            >
              Anterior
            </Link>
          )}
          {page < totalPages && (
            <Link
              href={buildPageUrl(searchParams, page + 1)}
              className="rounded border border-border px-3 py-1 text-text-primary transition-colors hover:bg-bg-secondary"
            >
              Próximo
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
