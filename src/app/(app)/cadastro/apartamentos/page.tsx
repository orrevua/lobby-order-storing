import { listApartments } from "@/application/use-cases/apartamentos/list-apartments";
import { apartmentRepository } from "@/infrastructure/supabase/repositories";
import { getServerUserWithCondo } from "@/infrastructure/supabase/server";
import { redirect } from "next/navigation";
import { ApartamentoList } from "@/components/cadastro/apartamento-list";
import { ApartamentoForm } from "@/components/cadastro/apartamento-form";
import { PageHeader } from "@/components/layout/page-header";

export default async function ApartamentosPage() {
  const ctx = await getServerUserWithCondo();
  if (!ctx) redirect("/login");

  const apartamentos = await listApartments(apartmentRepository, ctx.condominioId);

  return (
    <>
      <PageHeader title="Apartamentos" />
      <div className="space-y-6">
        <ApartamentoForm />
        <ApartamentoList apartamentos={apartamentos} canDelete={ctx.role === 'porteiro'} />
      </div>
    </>
  );
}
