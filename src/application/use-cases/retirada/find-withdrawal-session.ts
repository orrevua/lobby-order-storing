import type { EncomendaRepository } from '@/domain/repositories/encomenda-repository';
import type { WithdrawalSessionRepository } from '@/domain/repositories/withdrawal-session-repository';
import type { WithdrawalSession } from '@/domain/entities/withdrawal-session';
import type { EncomendaComMorador } from '@/domain/entities/encomenda';

type Result =
  | { status: 'not_found' }
  | { status: 'expired' }
  | { status: 'confirmed' }
  | { status: 'cancelled' }
  | { status: 'pending'; session: WithdrawalSession; encomendas: EncomendaComMorador[] };

export async function findWithdrawalSession(
  sessionRepo: WithdrawalSessionRepository,
  encomendaRepo: EncomendaRepository,
  sessionId: string,
): Promise<Result> {
  const session = await sessionRepo.findById(sessionId);

  if (!session) return { status: 'not_found' };
  if (session.status === 'confirmed') return { status: 'confirmed' };
  if (session.status === 'cancelled') return { status: 'cancelled' };

  if (session.status === 'pending' && new Date() > new Date(session.expiresAt)) {
    await sessionRepo.cancel(session.id);
    return { status: 'expired' };
  }

  if (session.status === 'expired') return { status: 'expired' };

  const pendentes = await encomendaRepo.listPending(session.apartamentoId);
  const encomendas = pendentes.filter((e) => session.encomendaIds.includes(e.id));

  return { status: 'pending', session, encomendas };
}
