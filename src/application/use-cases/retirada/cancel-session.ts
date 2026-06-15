import type { WithdrawalSessionRepository } from '@/domain/repositories/withdrawal-session-repository';

export async function cancelSession(
  sessionRepo: WithdrawalSessionRepository,
  sessionId: string,
) {
  const session = await sessionRepo.findById(sessionId);

  if (!session) throw new Error('Sessão não encontrada.');
  if (session.status !== 'pending') throw new Error('Sessão não está pendente.');

  await sessionRepo.cancel(sessionId);
}
