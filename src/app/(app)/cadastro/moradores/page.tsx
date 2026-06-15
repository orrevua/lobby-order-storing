import { listResidents } from '@/application/use-cases/moradores/list-residents';
import { listApartments } from '@/application/use-cases/apartamentos/list-apartments';
import { residentRepository, apartmentRepository } from '@/infrastructure/supabase/repositories';
import { getServerUser } from '@/infrastructure/supabase/server';
import { MoradorForm } from '@/components/cadastro/morador-form';
import { MoradorList } from '@/components/cadastro/morador-list';
import { PageHeader } from '@/components/layout/page-header';

export default async function MoradoresPage() {
  const user = await getServerUser();
  const role = user?.app_metadata.role || 'morador';

  const [moradores, apartamentos] = await Promise.all([
    role === 'morador' && user
      ? residentRepository.listByUser(user.id)
      : listResidents(residentRepository),
    listApartments(apartmentRepository),
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
