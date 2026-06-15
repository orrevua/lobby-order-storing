import { NextRequest, NextResponse } from 'next/server';
import { findWithdrawalSession } from '@/application/use-cases/retirada/find-withdrawal-session';
import { packageRepository, withdrawalSessionRepository } from '@/infrastructure/supabase/repositories';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await findWithdrawalSession(withdrawalSessionRepository, packageRepository, id);

  const messages: Record<string, string> = {
    not_found: 'Sessão não encontrada.',
    expired: 'Sessão expirada. Solicite um novo QR code ao porteiro.',
    confirmed: 'Retirada já confirmada.',
    cancelled: 'Sessão cancelada pelo porteiro.',
  };

  if (result.status !== 'pending') {
    return NextResponse.json({ status: result.status, message: messages[result.status] });
  }

  return NextResponse.json({
    status: 'pending',
    session: result.session,
    encomendas: result.encomendas,
  });
}
