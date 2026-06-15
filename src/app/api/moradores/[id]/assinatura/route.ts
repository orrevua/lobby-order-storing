import { NextRequest, NextResponse } from 'next/server';
import { storageService, residentRepository } from '@/infrastructure/supabase/repositories';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  
  const morador = await residentRepository.findById(Number(id));
  if (!morador || !morador.signatureUrl) {
    return NextResponse.json({ error: 'Assinatura não encontrada.' }, { status: 404 });
  }

  const signedUrl = await storageService.createSignedUrl(morador.signatureUrl);

  if (!signedUrl) {
    return NextResponse.json({ error: 'Erro ao gerar URL da assinatura.' }, { status: 500 });
  }

  return NextResponse.json({ signedUrl });
}
