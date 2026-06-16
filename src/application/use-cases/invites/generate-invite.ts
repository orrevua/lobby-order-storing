import { randomBytes } from 'crypto';
import type { InviteTokenRepository } from '@/domain/repositories/invite-token-repository';

export async function generateInvite(
  repo: InviteTokenRepository,
  input: { condominioId: string; createdBy: string; expiresAt: string | null; maxUses: number | null },
) {
  const token = randomBytes(32).toString('hex');
  return repo.create({ ...input, token });
}
