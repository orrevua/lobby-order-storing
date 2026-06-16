import { listPending } from '@/application/use-cases/encomendas/list-pending';
import { packageRepository, residentRepository } from '@/infrastructure/supabase/repositories';
import { getServerUserWithCondo } from '@/infrastructure/supabase/server';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default async function EncomendasPage() {
  const ctx = await getServerUserWithCondo();
  if (!ctx) redirect('/login');

  const myResidents = await residentRepository.listByUser(ctx.userId);
  const myResidentIds = new Set(myResidents.map((r) => r.id));

  const allPending = await listPending(packageRepository, ctx.condominioId);
  const encomendas = allPending.filter((e) => myResidentIds.has(e.moradorId));

  return (
    <>
      <PageHeader title="Minhas Encomendas" />
      {encomendas.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-tertiary">
          Nenhuma encomenda pendente para seus moradores.
        </p>
      ) : (
        <div className="space-y-3">
          {encomendas.map((enc) => (
            <div key={enc.id} className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-primary">{enc.morador.nome}</p>
                  <p className="text-xs text-text-tertiary">
                    {enc.morador.apartamento
                      ? `Bloco ${enc.morador.apartamento.bloco} - Apt ${enc.morador.apartamento.numero}`
                      : ''}
                  </p>
                </div>
                <span className="rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">
                  Pendente
                </span>
              </div>
              <div className="mt-2 text-xs text-text-secondary">
                {enc.descricao ?? 'Encomenda'}
                {enc.codigoRastreio ? ` • ${enc.codigoRastreio}` : ''}
                <span className="ml-2 text-text-tertiary">{formatDate(enc.dataChegada)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
