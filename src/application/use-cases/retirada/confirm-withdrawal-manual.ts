import type { EncomendaRepository } from '@/domain/repositories/encomenda-repository';
import type { WithdrawalSessionRepository } from '@/domain/repositories/withdrawal-session-repository';
import type { ManualReason } from '@/domain/entities/withdrawal-session';

type Input = {
  sessionId: string;
  manualReason: ManualReason;
  doormanNote: string | null;
  confirmedBy: string;
  cpf: string | null;
};

export async function confirmWithdrawalManual(
  sessionRepo: WithdrawalSessionRepository,
  encomendaRepo: EncomendaRepository,
  input: Input,
) {
  const session = await sessionRepo.findById(input.sessionId);

  if (!session) throw new Error('Sessão não encontrada.');
  if (session.status !== 'pending') throw new Error('Sessão já foi processada.');
  if (new Date() > new Date(session.expiresAt)) throw new Error('Sessão expirada.');

  if (input.cpf) {
    const { validateCPF } = await import('@/domain/validators/cpf');
    if (!validateCPF(input.cpf)) throw new Error('CPF inválido.');
  }

  await encomendaRepo.markDelivered(session.encomendaIds);

  return sessionRepo.confirm(input.sessionId, {
    confirmationMethod: 'manual',
    confirmedBy: input.confirmedBy,
    manualReason: input.manualReason,
    doormanNote: input.doormanNote,
    cpfConfirmacao: input.cpf,
  });
}
