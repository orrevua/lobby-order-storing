import { listApartments } from "@/application/use-cases/apartamentos/list-apartments";
import { listPending } from "@/application/use-cases/encomendas/list-pending";
import { apartmentRepository, packageRepository } from "@/infrastructure/supabase/repositories";
import { EntryForm } from "@/components/portaria/entry-form";
import { PendingList } from "@/components/portaria/pending-list";
import { PageHeader } from "@/components/layout/page-header";

export default async function PortariaPage() {
  const [apartamentos, pendentes] = await Promise.all([
    listApartments(apartmentRepository),
    listPending(packageRepository),
  ]);

  return (
    <>
      <PageHeader title="Portaria" />
      <div className="space-y-6">
        <EntryForm apartamentos={apartamentos} />
        <PendingList encomendas={pendentes} />
      </div>
    </>
  );
}
