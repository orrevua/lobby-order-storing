"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import type { Apartamento } from "@/domain/entities";

function ApartamentoCombobox({
  apartamentos,
  value,
  onChange,
}: {
  apartamentos: Apartamento[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selected = apartamentos.find((a) => String(a.id) === value);
  const label = selected ? `Bloco ${selected.bloco} - Apt ${selected.numero}` : "";
  const filtered = apartamentos.filter((a) => {
    const text = `Bloco ${a.bloco} - Apt ${a.numero}`.toLowerCase();
    return text.includes(search.toLowerCase());
  });

  return (
    <div ref={ref} className="relative">
      <label htmlFor="filter-apt" className="mb-1 block text-sm font-medium text-text-secondary">Apartamento</label>
      <input
        id="filter-apt"
        type="text"
        placeholder="Todos"
        value={open ? search : label}
        onFocus={() => { setOpen(true); setSearch(""); }}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
      {value && !open && (
        <button
          type="button"
          onClick={() => { onChange(""); setSearch(""); }}
          className="absolute right-2 top-[calc(50%+2px)] text-text-tertiary hover:text-text-primary"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      {open && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-bg-primary shadow-lg">
          <li>
            <button
              type="button"
              onClick={() => { onChange(""); setSearch(""); setOpen(false); }}
              className="w-full px-3 py-2 text-left text-sm text-text-tertiary hover:bg-bg-secondary"
            >
              Todos
            </button>
          </li>
          {filtered.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => { onChange(String(a.id)); setSearch(""); setOpen(false); }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-bg-secondary ${
                  String(a.id) === value ? "text-accent font-medium" : "text-text-primary"
                }`}
              >
                Bloco {a.bloco} - Apt {a.numero}
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-text-tertiary">Nenhum resultado</li>
          )}
        </ul>
      )}
    </div>
  );
}

type Props = {
  apartamentos: Apartamento[];
};

export function SearchFilters({ apartamentos }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [dataInicio, setDataInicio] = useState(searchParams.get("dataInicio") ?? "");
  const [dataFim, setDataFim] = useState(searchParams.get("dataFim") ?? "");
  const [apartamentoId, setApartamentoId] = useState(searchParams.get("apartamentoId") ?? "");
  const [nomeMorador, setNomeMorador] = useState(searchParams.get("nomeMorador") ?? "");
  const [codigoRastreio, setCodigoRastreio] = useState(searchParams.get("codigoRastreio") ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (dataInicio) params.set("dataInicio", dataInicio);
    if (dataFim) params.set("dataFim", dataFim);
    if (apartamentoId) params.set("apartamentoId", apartamentoId);
    if (nomeMorador) params.set("nomeMorador", nomeMorador);
    if (codigoRastreio) params.set("codigoRastreio", codigoRastreio);
    params.set("page", "1");
    router.push(`/consulta?${params.toString()}`);
  }

  function handleClear() {
    setDataInicio("");
    setDataFim("");
    setApartamentoId("");
    setNomeMorador("");
    setCodigoRastreio("");
    router.push("/consulta");
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-bg-secondary p-4">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">Filtros de Busca</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label htmlFor="filter-data-inicio" className="mb-1 block text-sm font-medium text-text-secondary">Data Início</label>
          <input
            id="filter-data-inicio"
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div>
          <label htmlFor="filter-data-fim" className="mb-1 block text-sm font-medium text-text-secondary">Data Fim</label>
          <input
            id="filter-data-fim"
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <ApartamentoCombobox
          apartamentos={apartamentos}
          value={apartamentoId}
          onChange={setApartamentoId}
        />
        <div>
          <label htmlFor="filter-morador" className="mb-1 block text-sm font-medium text-text-secondary">Nome do Morador</label>
          <input
            id="filter-morador"
            type="text"
            value={nomeMorador}
            onChange={(e) => setNomeMorador(e.target.value)}
            className="w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div>
          <label htmlFor="filter-rastreio" className="mb-1 block text-sm font-medium text-text-secondary">Código de Rastreio</label>
          <input
            id="filter-rastreio"
            type="text"
            value={codigoRastreio}
            onChange={(e) => setCodigoRastreio(e.target.value)}
            className="w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-hover"
        >
          Buscar
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="rounded-md border border-border bg-bg-primary px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-tertiary"
        >
          Limpar
        </button>
      </div>
    </form>
  );
}
