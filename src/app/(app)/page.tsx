import { redirect } from 'next/navigation';
import { getServerUserWithCondo } from '@/infrastructure/supabase/server';

export default async function Home() {
  const ctx = await getServerUserWithCondo();
  if (!ctx) redirect('/login');

  redirect(ctx.role === 'morador' ? '/cadastro/moradores' : '/portaria');
}
