'use server';

import { inviteTokenRepository } from '@/infrastructure/supabase/repositories';
import { getServerUserWithCondo } from '@/infrastructure/supabase/server';
import { generateInvite } from '@/application/use-cases/invites/generate-invite';
import type { ActionResult } from '@/lib/types';
import type { InviteToken } from '@/domain/entities';

export async function createInvite(formData: FormData): Promise<ActionResult<InviteToken>> {
  const ctx = await getServerUserWithCondo();
  if (!ctx) return { success: false, error: 'Não autenticado.' };

  const maxUsesRaw = formData.get('max_uses')?.toString().trim();
  const expiresAtRaw = formData.get('expires_at')?.toString().trim();

  try {
    const token = await generateInvite(inviteTokenRepository, {
      condominioId: ctx.condominioId,
      createdBy: ctx.userId,
      maxUses: maxUsesRaw ? parseInt(maxUsesRaw, 10) : null,
      expiresAt: expiresAtRaw || null,
    });
    return { success: true, data: token };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro desconhecido.' };
  }
}

export async function listInvites(): Promise<InviteToken[]> {
  const ctx = await getServerUserWithCondo();
  if (!ctx) return [];
  return inviteTokenRepository.listByCondominium(ctx.condominioId);
}

export async function invalidateInvite(id: string): Promise<ActionResult<null>> {
  const ctx = await getServerUserWithCondo();
  if (!ctx) return { success: false, error: 'Não autenticado.' };

  try {
    await inviteTokenRepository.invalidate(id);
    return { success: true, data: null };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro desconhecido.' };
  }
}
