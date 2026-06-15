import { NextRequest, NextResponse } from 'next/server';
import { storageService } from '@/infrastructure/supabase/repositories';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const signedUrl = await storageService.getMoradorSignatureUrl(Number(id));

  if (!signedUrl) {
    return NextResponse.json({ error: 'Assinatura não encontrada.' }, { status: 404 });
  }

  return NextResponse.json({ signedUrl });
}
