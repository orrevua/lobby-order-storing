import type { EncomendaRepository } from '@/domain/repositories/encomenda-repository';
import type { WithdrawalSessionRepository } from '@/domain/repositories/withdrawal-session-repository';

import { validateCPF } from '@/domain/validators/cpf';

export async function confirmWithdrawalQr(
  sessionRepo: WithdrawalSessionRepository,
  encomendaRepo: EncomendaRepository,
  sessionId: string,
  cpf: string | null,
  signatureUrl: string | null,
) {
  const session = await sessionRepo.findById(sessionId);

  if (!session) throw new Error('Sessão não encontrada.');
  if (session.status !== 'pending') throw new Error('Sessão já foi processada.');
  if (new Date() > new Date(session.expiresAt)) throw new Error('Sessão expirada.');
  if (cpf && !validateCPF(cpf)) throw new Error('CPF inválido.');

  await encomendaRepo.markDelivered(session.encomendaIds);

  return sessionRepo.confirm(sessionId, {
    confirmationMethod: 'qr_scan',
    confirmedBy: 'resident',
    cpfConfirmacao: cpf,
    signatureUrl,
  });
}
