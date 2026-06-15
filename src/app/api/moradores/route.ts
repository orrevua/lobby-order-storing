import { NextRequest, NextResponse } from 'next/server';
import { listResidentsByApartment } from '@/application/use-cases/moradores/list-residents-by-apartment';
import { residentRepository } from '@/infrastructure/supabase/repositories';

export async function GET(request: NextRequest) {
  const apartamentoId = request.nextUrl.searchParams.get('apartamento_id');

  if (!apartamentoId) {
    return NextResponse.json([], { status: 200 });
  }

  try {
    const moradores = await listResidentsByApartment(
      residentRepository,
      Number(apartamentoId)
    );
    return NextResponse.json(moradores);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
