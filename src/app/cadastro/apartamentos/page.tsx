import { listApartments } from "@/application/use-cases/apartamentos/list-apartments";
import { apartmentRepository } from "@/infrastructure/supabase/repositories";
import { ApartamentoList } from "@/components/cadastro/apartamento-list";
import { ApartamentoForm } from "@/components/cadastro/apartamento-form";
import { PageHeader } from "@/components/layout/page-header";

export default async function ApartamentosPage() {
  const apartamentos = await listApartments(apartmentRepository);

  return (
    <>
      <PageHeader title="Apartamentos" />
      <div className="space-y-6">
        <ApartamentoForm />
        <ApartamentoList apartamentos={apartamentos} />
      </div>
    </>
  );
}
