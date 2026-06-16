'use server';

import { supabaseAdmin } from '@/infrastructure/supabase/admin';
import { condominiumRepository, inviteTokenRepository } from '@/infrastructure/supabase/repositories';
import { createCondominium } from '@/application/use-cases/condominios/create-condominium';
import { validateInvite } from '@/application/use-cases/invites/validate-invite';
import type { ActionResult } from '@/lib/types';

export async function signUpPortaria(
  email: string,
  password: string,
  condoName: string,
  condoAddress: string | null,
): Promise<ActionResult> {
  try {
    const condo = await createCondominium(condominiumRepository, {
      name: condoName,
      address: condoAddress,
    });

    const { error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: 'porteiro', condominio_id: condo.id },
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro desconhecido.' };
  }
}

export async function signUpMorador(
  email: string,
  password: string,
  token: string,
): Promise<ActionResult> {
  try {
    const result = await validateInvite(inviteTokenRepository, token);

    if (!result.valid) return { success: false, error: result.reason };

    const { error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: 'morador', condominio_id: result.condominioId },
    });

    if (error) return { success: false, error: error.message };

    await inviteTokenRepository.incrementUseCount(result.tokenId);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro desconhecido.' };
  }
}
