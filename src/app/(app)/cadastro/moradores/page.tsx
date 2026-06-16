import { listResidents } from '@/application/use-cases/moradores/list-residents';
import { listApartments } from '@/application/use-cases/apartamentos/list-apartments';
import { residentRepository, apartmentRepository } from '@/infrastructure/supabase/repositories';
import { getServerUserWithCondo } from '@/infrastructure/supabase/server';
import { redirect } from 'next/navigation';
import { MoradorForm } from '@/components/cadastro/morador-form';
import { MoradorList } from '@/components/cadastro/morador-list';
import { PageHeader } from '@/components/layout/page-header';

export default async function MoradoresPage() {
  const ctx = await getServerUserWithCondo();
  if (!ctx) redirect('/login');

  const [moradores, apartamentos] = await Promise.all([
    ctx.role === 'morador'
      ? residentRepository.listByUser(ctx.userId)
      : listResidents(residentRepository, ctx.condominioId),
    listApartments(apartmentRepository, ctx.condominioId),
  ]);

  return (
    <>
      <PageHeader title="Moradores" />
      <div className="space-y-6">
        <MoradorForm apartamentos={apartamentos} />
        <MoradorList moradores={moradores} apartamentos={apartamentos} />
      </div>
    </>
  );
}
