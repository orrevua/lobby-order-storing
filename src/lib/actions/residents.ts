'use server';

import { revalidatePath } from 'next/cache';
import { residentRepository, storageService } from '@/infrastructure/supabase/repositories';
import { createResident as createResidentUC } from '@/application/use-cases/moradores/create-resident';
import { updateResident as updateResidentUC } from '@/application/use-cases/moradores/update-resident';
import { deleteResident as deleteResidentUC } from '@/application/use-cases/moradores/delete-resident';
import { cleanCPF } from '@/domain/validators/cpf';
import type { ActionResult } from '@/lib/types';
import type { Morador } from '@/domain/entities';

async function extractSignatureFile(formData: FormData): Promise<{ buffer: Buffer; contentType: string } | null> {
  const file = formData.get('signature');
  if (!file || !(file instanceof File) || file.size === 0) return null;
  if (!file.type.startsWith('image/')) return null;
  const buffer = Buffer.from(await file.arrayBuffer());
  return { buffer, contentType: file.type };
}

export async function createResident(formData: FormData): Promise<ActionResult<Morador>> {
  const nome = formData.get('nome')?.toString().trim() ?? '';
  const contato = formData.get('contato')?.toString().trim() || null;
  const rawCpf = cleanCPF(formData.get('cpf')?.toString() ?? '');
  const cpf = rawCpf.length === 11 ? rawCpf : null;
  const apartamentoId = Number(formData.get('apartamento_id'));

  try {
    let morador = await createResidentUC(residentRepository, { nome, contato, cpf, signatureUrl: null, apartamentoId });

    const sig = await extractSignatureFile(formData);
    if (sig) {
      const path = await storageService.uploadMoradorSignature(morador.id, sig.buffer, sig.contentType);
      morador = await updateResidentUC(residentRepository, morador.id, { nome, contato, cpf, signatureUrl: path, apartamentoId });
    }

    revalidatePath('/cadastro/moradores');
    return { success: true, data: morador };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro desconhecido.' };
  }
}

export async function updateResident(id: number, formData: FormData): Promise<ActionResult<Morador>> {
  const nome = formData.get('nome')?.toString().trim() ?? '';
  const contato = formData.get('contato')?.toString().trim() || null;
  const rawCpf = cleanCPF(formData.get('cpf')?.toString() ?? '');
  const cpf = rawCpf.length === 11 ? rawCpf : null;
  const apartamentoId = Number(formData.get('apartamento_id'));

  try {
    const sig = await extractSignatureFile(formData);
    let signatureUrl = formData.get('existing_signature_url')?.toString() || null;

    if (sig) {
      signatureUrl = await storageService.uploadMoradorSignature(id, sig.buffer, sig.contentType);
    }

    const data = await updateResidentUC(residentRepository, id, { nome, contato, cpf, signatureUrl, apartamentoId });
    revalidatePath('/cadastro/moradores');
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro desconhecido.' };
  }
}

export async function deleteResident(id: number): Promise<ActionResult> {
  try {
    await deleteResidentUC(residentRepository, id);
    revalidatePath('/cadastro/moradores');
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro desconhecido.' };
  }
}
