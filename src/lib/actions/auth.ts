'use server';

import { supabaseAdmin } from '@/infrastructure/supabase/admin';
import type { ActionResult } from '@/lib/types';

export async function signUp(
  email: string,
  password: string,
  role: 'porteiro' | 'morador',
): Promise<ActionResult> {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
