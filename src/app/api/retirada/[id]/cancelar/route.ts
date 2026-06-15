import { NextRequest, NextResponse } from 'next/server';
import { cancelSession } from '@/application/use-cases/retirada/cancel-session';
import { withdrawalSessionRepository } from '@/infrastructure/supabase/repositories';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await cancelSession(withdrawalSessionRepository, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno.';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
