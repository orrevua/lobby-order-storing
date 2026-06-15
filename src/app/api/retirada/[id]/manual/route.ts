import { NextRequest, NextResponse } from 'next/server';
import { confirmWithdrawalManual } from '@/application/use-cases/retirada/confirm-withdrawal-manual';
import { packageRepository, withdrawalSessionRepository } from '@/infrastructure/supabase/repositories';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { manualReason, doormanNote, confirmedBy, cpf } = body;

    if (!manualReason || !confirmedBy) {
      return NextResponse.json({ success: false, error: 'Motivo e identificação obrigatórios.' }, { status: 400 });
    }

    await confirmWithdrawalManual(withdrawalSessionRepository, packageRepository, {
      sessionId: id,
      manualReason,
      doormanNote: doormanNote ?? null,
      confirmedBy,
      cpf: cpf ?? null,
    });

    return NextResponse.json({ success: true, message: 'Retirada manual confirmada.' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno.';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
