import { findWithdrawalSession } from '@/application/use-cases/retirada/find-withdrawal-session';
import { apartmentRepository, packageRepository, residentRepository, withdrawalSessionRepository, storageService } from '@/infrastructure/supabase/repositories';
import { getServerUserWithCondo } from '@/infrastructure/supabase/server';
import { redirect } from 'next/navigation';
import { ConfirmationForm } from '@/components/retirada/confirmation-form';

export default async function RetiradaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getServerUserWithCondo();
  if (!ctx) redirect('/login');

  const { id } = await params;
  const result = await findWithdrawalSession(apartmentRepository, withdrawalSessionRepository, packageRepository, id);

  if (result.status === 'not_found') {
    return (
      <div className="rounded-xl border border-border bg-bg-secondary p-6 text-center">
        <p className="text-lg font-medium text-text-primary">Sessão não encontrada</p>
        <p className="mt-2 text-sm text-text-tertiary">O link pode estar incorreto ou já ter expirado.</p>
      </div>
    );
  }

  if (result.status === 'expired') {
    return (
      <div className="rounded-xl border border-border bg-bg-secondary p-6 text-center">
        <p className="text-lg font-medium text-text-primary">Sessão expirada</p>
        <p className="mt-2 text-sm text-text-tertiary">Solicite um novo QR code ao porteiro.</p>
      </div>
    );
  }

  if (result.status === 'confirmed') {
    return (
      <div className="rounded-xl border border-success/30 bg-success/5 p-6 text-center">
        <p className="text-lg font-medium text-success">Retirada confirmada!</p>
        <p className="mt-2 text-sm text-text-tertiary">As encomendas já foram registradas como entregues.</p>
      </div>
    );
  }

  if (result.status === 'cancelled') {
    return (
      <div className="rounded-xl border border-border bg-bg-secondary p-6 text-center">
        <p className="text-lg font-medium text-text-primary">Sessão cancelada</p>
        <p className="mt-2 text-sm text-text-tertiary">Esta sessão foi cancelada pelo porteiro.</p>
      </div>
    );
  }

  const myResidents = await residentRepository.listByUser(ctx.userId);
  const myResidentIds = new Set(myResidents.map((r) => r.id));
  const matchingMorador = result.encomendas.find((e) => myResidentIds.has(e.moradorId))?.morador;

  if (!matchingMorador) {
    return (
      <div className="rounded-xl border border-border bg-bg-secondary p-6 text-center">
        <p className="text-lg font-medium text-text-primary">Acesso negado</p>
        <p className="mt-2 text-sm text-text-tertiary">Estas encomendas não pertencem aos seus moradores cadastrados.</p>
      </div>
    );
  }

  const signatureImageUrl = matchingMorador.signatureUrl
    ? await storageService.createSignedUrl(matchingMorador.signatureUrl)
    : null;

  return (
    <ConfirmationForm
      sessionId={id}
      moradorNome={matchingMorador.nome}
      prefillCpf={matchingMorador.cpf}
      signatureImageUrl={signatureImageUrl}
      moradorSignaturePath={matchingMorador.signatureUrl}
      encomendas={result.encomendas.map((e) => ({
        id: e.id,
        descricao: e.descricao,
        codigoRastreio: e.codigoRastreio,
        moradorNome: e.morador.nome,
      }))}
    />
  );
}
