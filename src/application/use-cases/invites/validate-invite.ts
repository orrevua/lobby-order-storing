import type { InviteTokenRepository } from '@/domain/repositories/invite-token-repository';

type ValidationResult =
  | { valid: true; condominioId: string; tokenId: string }
  | { valid: false; reason: string };

export async function validateInvite(
  repo: InviteTokenRepository,
  token: string,
): Promise<ValidationResult> {
  const invite = await repo.findByToken(token);

  if (!invite) return { valid: false, reason: 'Convite inválido.' };

  if (invite.invalidatedAt) return { valid: false, reason: 'Convite foi invalidado.' };

  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
    return { valid: false, reason: 'Convite expirado.' };
  }

  if (invite.maxUses !== null && invite.useCount >= invite.maxUses) {
    return { valid: false, reason: 'Convite já utilizado o número máximo de vezes.' };
  }

  return { valid: true, condominioId: invite.condominioId, tokenId: invite.id };
}
