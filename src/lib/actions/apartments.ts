'use server';

import { revalidatePath } from 'next/cache';
import { apartmentRepository } from '@/infrastructure/supabase/repositories';
import { createApartment as createApartmentUC } from '@/application/use-cases/apartamentos/create-apartment';
import { updateApartment as updateApartmentUC } from '@/application/use-cases/apartamentos/update-apartment';
import { deleteApartment as deleteApartmentUC } from '@/application/use-cases/apartamentos/delete-apartment';
import type { ActionResult } from '@/lib/types';
import type { Apartamento } from '@/domain/entities';

export async function createApartment(formData: FormData): Promise<ActionResult<Apartamento>> {
  const numero = formData.get('numero')?.toString().trim() ?? '';
  const bloco = formData.get('bloco')?.toString().trim() ?? '';
  try {
    const data = await createApartmentUC(apartmentRepository, { numero, bloco });
    revalidatePath('/cadastro/apartamentos');
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro desconhecido.' };
  }
}

export async function updateApartment(id: number, formData: FormData): Promise<ActionResult<Apartamento>> {
  const numero = formData.get('numero')?.toString().trim() ?? '';
  const bloco = formData.get('bloco')?.toString().trim() ?? '';
  try {
    const data = await updateApartmentUC(apartmentRepository, id, { numero, bloco });
    revalidatePath('/cadastro/apartamentos');
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro desconhecido.' };
  }
}

export async function deleteApartment(id: number): Promise<ActionResult> {
  try {
    await deleteApartmentUC(apartmentRepository, id);
    revalidatePath('/cadastro/apartamentos');
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro desconhecido.' };
  }
}
