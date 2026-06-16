import { searchPackages } from '@/application/use-cases/encomendas/search-packages';
import { listApartments } from '@/application/use-cases/apartamentos/list-apartments';
import { packageRepository, apartmentRepository } from '@/infrastructure/supabase/repositories';
import { getServerUserWithCondo } from '@/infrastructure/supabase/server';
import { redirect } from 'next/navigation';
import { SearchFilters } from '@/components/consulta/search-filters';
import { ResultsTable } from '@/components/consulta/results-table';
import { PageHeader } from '@/components/layout/page-header';
import type { SearchFilters as SearchFiltersType } from '@/domain/entities/search-filters';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ConsultaPage({ searchParams }: Props) {
  const ctx = await getServerUserWithCondo();
  if (!ctx) redirect('/login');

  const params = await searchParams;
  const page = Number(params.page) || 1;
  const perPage = 20;

  const filters: SearchFiltersType = {
    dataInicio: typeof params.dataInicio === 'string' ? params.dataInicio : undefined,
    dataFim: typeof params.dataFim === 'string' ? params.dataFim : undefined,
    apartamentoId: typeof params.apartamentoId === 'string' ? Number(params.apartamentoId) || undefined : undefined,
    nomeMorador: typeof params.nomeMorador === 'string' ? params.nomeMorador : undefined,
    codigoRastreio: typeof params.codigoRastreio === 'string' ? params.codigoRastreio : undefined,
    page,
    perPage,
  };

  const [{ data: encomendas, total }, apartamentos] = await Promise.all([
    searchPackages(packageRepository, ctx.condominioId, filters),
    listApartments(apartmentRepository, ctx.condominioId),
  ]);

  const cleanParams: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value) cleanParams[key] = value;
  }

  return (
    <>
      <PageHeader title="Consulta" />
      <div className="space-y-6">
        <SearchFilters apartamentos={apartamentos} />
        <ResultsTable
          encomendas={encomendas}
          total={total}
          page={page}
          perPage={perPage}
          searchParams={cleanParams}
        />
      </div>
    </>
  );
}
