import { NextRequest, NextResponse } from 'next/server';
import { storageService, withdrawalSessionRepository } from '@/infrastructure/supabase/repositories';

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'Tipo de arquivo inválido. Use JPEG, PNG ou WebP.' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: 'Arquivo muito grande. Máximo 5MB.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const path = await storageService.uploadSignature(id, buffer, file.type);

    return NextResponse.json({ success: true, signatureUrl: path });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  
  const session = await withdrawalSessionRepository.findById(id);
  if (!session || !session.signatureUrl) {
    return NextResponse.json({ error: 'Assinatura não encontrada.' }, { status: 404 });
  }

  const signedUrl = await storageService.createSignedUrl(session.signatureUrl);

  if (!signedUrl) {
    return NextResponse.json({ error: 'Erro ao gerar URL da assinatura.' }, { status: 500 });
  }

  return NextResponse.redirect(signedUrl);
}
