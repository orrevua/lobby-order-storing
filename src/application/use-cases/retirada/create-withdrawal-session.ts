import type { EncomendaRepository } from '@/domain/repositories/encomenda-repository';
import type { WithdrawalSessionRepository } from '@/domain/repositories/withdrawal-session-repository';

type Input = {
  apartamentoId: number;
  encomendaIds: number[];
  createdBy: string | null;
};

const TTL_MINUTES = 5;

export async function createWithdrawalSession(
  encomendaRepo: EncomendaRepository,
  sessionRepo: WithdrawalSessionRepository,
  input: Input,
) {
  if (input.encomendaIds.length === 0) {
    throw new Error('Nenhuma encomenda selecionada.');
  }

  const pendentes = await encomendaRepo.listPending(input.apartamentoId);
  const pendenteIds = new Set(pendentes.map((e) => e.id));

  for (const id of input.encomendaIds) {
    if (!pendenteIds.has(id)) {
      throw new Error(`Encomenda ${id} não está pendente ou não pertence ao apartamento.`);
    }
  }

  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000).toISOString();

  return sessionRepo.create({
    apartamentoId: input.apartamentoId,
    encomendaIds: input.encomendaIds,
    expiresAt,
    createdBy: input.createdBy,
  });
}
