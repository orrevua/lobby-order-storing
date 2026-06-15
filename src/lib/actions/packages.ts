'use server';

import { revalidatePath } from 'next/cache';
import { packageRepository } from '@/infrastructure/supabase/repositories';
import { registerPackage as registerPackageUC } from '@/application/use-cases/encomendas/register-package';
import { markWithdrawn as markWithdrawnUC } from '@/application/use-cases/encomendas/mark-withdrawn';
import type { ActionResult } from '@/lib/types';
import type { Encomenda } from '@/domain/entities';

export async function registerPackage(formData: FormData): Promise<ActionResult<Encomenda>> {
  const moradorId = Number(formData.get('morador_id'));
  const codigoRastreio = formData.get('codigo_rastreio')?.toString().trim() || null;
  const descricao = formData.get('descricao')?.toString().trim() || null;
  const receivedBy = formData.get('received_by')?.toString().trim() || null;

  try {
    const data = await registerPackageUC(packageRepository, {
      moradorId,
      codigoRastreio,
      descricao,
      receivedBy,
    });
    revalidatePath('/portaria');
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro desconhecido.' };
  }
}

export async function markWithdrawn(id: number): Promise<ActionResult<Encomenda>> {
  try {
    const data = await markWithdrawnUC(packageRepository, id);
    revalidatePath('/portaria');
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro desconhecido.' };
  }
}
