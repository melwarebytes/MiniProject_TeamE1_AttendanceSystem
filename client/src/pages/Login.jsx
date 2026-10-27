import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import AuthCard, { Alert, Field } from '../components/AuthCard';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(
        err.code === 'ACCOUNT_LOCKED'
          ? 'Too many failed attempts. Your account is locked for 15 minutes.'
          : err.code === 'RATE_LIMITED'
          ? 'Too many attempts from this network. Wait a minute and try again.'
          : 'Invalid email or password.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Log in" subtitle="Use your institutional email.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <Field id="email" label="Email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field id="password" label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold rounded-lg py-2.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          {busy ? 'Logging in…' : 'Log in'}
        </button>
        <div className="text-center">
          <Link to="/forgot-password" className="text-sm text-indigo-700 hover:underline">
            Forgot password?
          </Link>
        </div>
      </form>
    </AuthCard>
  );
}
