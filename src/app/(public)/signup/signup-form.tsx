'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signUpPortaria, signUpMorador } from '@/lib/actions/auth';
import Link from 'next/link';

export function SignupForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [condoName, setCondoName] = useState('');
  const [condoAddress, setCondoAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = token
      ? await signUpMorador(email, password, token)
      : await signUpPortaria(email, password, condoName, condoAddress || null);

    if (!result.success) {
      setError(result.error);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  }

  if (success) {
    return (
      <div className="w-full max-w-md rounded-xl border border-border bg-bg-secondary p-8 shadow-sm text-center">
        <h1 className="mb-4 text-2xl font-bold text-success">Cadastro Realizado!</h1>
        <p className="mb-6 text-text-secondary">Conta criada. Você já pode fazer login.</p>
        <Link href="/login" className="text-accent hover:underline text-sm font-medium">
          Ir para o Login
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-border bg-bg-secondary p-8 shadow-sm">
      <h1 className="mb-2 text-2xl font-bold text-text-primary">
        {token ? 'Cadastro de Morador' : 'Cadastro de Portaria'}
      </h1>
      <p className="mb-6 text-sm text-text-tertiary">
        {token
          ? 'Crie sua conta de morador para acessar o sistema.'
          : 'Crie sua conta e registre seu condomínio.'}
      </p>

      {error && (
        <div className="mb-4 rounded-md bg-error/10 p-3 text-sm text-error">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {!token && (
          <>
            <div>
              <label htmlFor="signup-condo-name" className="block text-sm font-medium text-text-secondary">
                Nome do Condomínio *
              </label>
              <input
                id="signup-condo-name"
                type="text"
                value={condoName}
                onChange={(e) => setCondoName(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                required
              />
            </div>
            <div>
              <label htmlFor="signup-condo-address" className="block text-sm font-medium text-text-secondary">
                Endereço
              </label>
              <input
                id="signup-condo-address"
                type="text"
                value={condoAddress}
                onChange={(e) => setCondoAddress(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
              />
            </div>
          </>
        )}
        <div>
          <label htmlFor="signup-email" className="block text-sm font-medium text-text-secondary">Email *</label>
          <input
            id="signup-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
            required
          />
        </div>
        <div>
          <label htmlFor="signup-password" className="block text-sm font-medium text-text-secondary">Senha *</label>
          <input
            id="signup-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-accent py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {loading ? 'Cadastrando...' : 'Cadastrar'}
        </button>
      </form>
      <div className="mt-6 text-center">
        <Link href="/login" className="text-sm text-text-tertiary hover:text-accent">
          Já tem uma conta? Entre aqui
        </Link>
      </div>
    </div>
  );
}
