import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { confirmWithdrawalQr } from '@/application/use-cases/retirada/confirm-withdrawal-qr';
import { packageRepository, withdrawalSessionRepository } from '@/infrastructure/supabase/repositories';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const cpf = body.cpf ?? null;
    const signatureUrl = body.signatureUrl ?? null;
    await confirmWithdrawalQr(withdrawalSessionRepository, packageRepository, id, cpf, signatureUrl);
    
    revalidatePath('/portaria');
    revalidatePath('/consulta');
    
    return NextResponse.json({ success: true, message: 'Retirada confirmada com sucesso.' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno.';
    const status = message.includes('não encontrada') ? 404
      : message.includes('expirada') ? 410
      : message.includes('processada') ? 409
      : 400;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
