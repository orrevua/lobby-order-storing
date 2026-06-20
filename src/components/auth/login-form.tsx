'use client';

import { useState } from 'react';
import { supabaseClient } from '@/infrastructure/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push(redirectTo || '/');
      router.refresh();
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex items-center gap-3 lg:hidden">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" className="h-8 w-8">
          <path d="M6 15 L16 19 L16 30 L6 26 Z" fill="#C2410C" opacity="0.25" stroke="#C2410C" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M16 19 L28 14 L28 25 L16 30 Z" fill="#C2410C" opacity="0.12" stroke="#C2410C" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M6 15 L16 10 L28 14 L16 19 Z" fill="#C2410C" opacity="0.06" stroke="#C2410C" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M6 15 L16 10 L12 3 L2 8 Z" fill="#C2410C" opacity="0.18" stroke="#C2410C" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M16 10 L28 14 L30 6 L18 2 Z" fill="#C2410C" opacity="0.1" stroke="#C2410C" strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
        <span className="text-lg font-semibold text-text-primary">LobbyEasy</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-text-primary">Bem-vindo de volta</h1>
        <p className="mt-1 text-sm text-text-tertiary">Entre com suas credenciais para continuar</p>
      </div>

      {error && (
        <div className="mt-5 flex items-center gap-2 rounded-lg bg-error/8 px-4 py-3 text-sm text-error">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} className="mt-8 space-y-5">
        <div>
          <label htmlFor="login-email" className="block text-sm font-medium text-text-secondary">Email</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            className="mt-1.5 w-full rounded-lg border border-border bg-bg-primary px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary/60 focus:border-accent focus:ring-1 focus:ring-accent/30 focus:outline-none transition-colors"
            required
          />
        </div>
        <div>
          <label htmlFor="login-password" className="block text-sm font-medium text-text-secondary">Senha</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="mt-1.5 w-full rounded-lg border border-border bg-bg-primary px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary/60 focus:border-accent focus:ring-1 focus:ring-accent/30 focus:outline-none transition-colors"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-accent-hover hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:hover:shadow-sm"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Entrando...
            </span>
          ) : (
            'Entrar'
          )}
        </button>
      </form>
    </div>
  );
}
