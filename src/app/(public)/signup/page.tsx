'use client';

import { useState } from 'react';
import { signUp } from '@/lib/actions/auth';
import Link from 'next/link';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'porteiro' | 'morador'>('morador');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signUp(email, password, role);

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
      <h1 className="mb-6 text-2xl font-bold text-text-primary">Criar Conta</h1>

      {error && (
        <div className="mb-4 rounded-md bg-error/10 p-3 text-sm text-error">
          {error}
        </div>
      )}

      <form onSubmit={handleSignup} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary">Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary">Tipo de Usuário</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'porteiro' | 'morador')}
            className="mt-1 w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
          >
            <option value="morador">Morador</option>
            <option value="porteiro">Porteiro</option>
          </select>
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
