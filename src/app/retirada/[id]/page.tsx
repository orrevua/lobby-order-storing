import { findWithdrawalSession } from '@/application/use-cases/retirada/find-withdrawal-session';
import { packageRepository, withdrawalSessionRepository, storageService } from '@/infrastructure/supabase/repositories';
import { ConfirmationForm } from '@/components/retirada/confirmation-form';

export default async function RetiradaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await findWithdrawalSession(withdrawalSessionRepository, packageRepository, id);

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

  const morador = result.encomendas[0]?.morador;
  const prefillCpf = morador?.cpf ?? null;
  const moradorSignaturePath = morador?.signatureUrl ?? null;
  const signatureImageUrl = morador?.id
    ? await storageService.getMoradorSignatureUrl(morador.id)
    : null;

  return (
    <ConfirmationForm
      sessionId={id}
      prefillCpf={prefillCpf}
      signatureImageUrl={signatureImageUrl}
      moradorSignaturePath={moradorSignaturePath}
      encomendas={result.encomendas.map((e) => ({
        id: e.id,
        descricao: e.descricao,
        codigoRastreio: e.codigoRastreio,
        moradorNome: e.morador.nome,
      }))}
    />
  );
}
