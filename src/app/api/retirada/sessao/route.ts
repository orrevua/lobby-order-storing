import { NextRequest, NextResponse } from 'next/server';
import { createWithdrawalSession } from '@/application/use-cases/retirada/create-withdrawal-session';
import { packageRepository, withdrawalSessionRepository } from '@/infrastructure/supabase/repositories';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apartamentoId, encomendaIds, createdBy } = body;

    if (!apartamentoId || !Array.isArray(encomendaIds) || encomendaIds.length === 0) {
      return NextResponse.json({ success: false, error: 'Dados inválidos.' }, { status: 400 });
    }

    const session = await createWithdrawalSession(packageRepository, withdrawalSessionRepository, {
      apartamentoId,
      encomendaIds,
      createdBy: createdBy ?? null,
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.id,
        expiresAt: session.expiresAt,
        qrCodeUrl: `${appUrl}/retirada/${session.id}`,
      },
    }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno.';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
