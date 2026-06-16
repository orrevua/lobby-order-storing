import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function getServerUser() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export type UserContext = {
  userId: string;
  role: string;
  condominioId: string;
};

export async function getServerUserWithCondo(): Promise<UserContext | null> {
  const user = await getServerUser();
  if (!user) return null;

  const role = user.app_metadata.role || 'morador';
  const condominioId = user.app_metadata.condominio_id;

  if (!condominioId) return null;

  return { userId: user.id, role, condominioId };
}
