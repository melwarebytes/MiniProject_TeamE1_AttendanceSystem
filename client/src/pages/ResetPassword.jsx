import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import AuthCard, { Alert, Field } from '../components/AuthCard';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) return setError('The two passwords do not match.');
    try {
      await api.confirmPasswordReset(token, password);
      setDone(true);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AuthCard title="Choose a new password" subtitle="At least 10 characters. Common passwords are not allowed.">
      {done ? (
        <div className="space-y-4">
          <Alert kind="success">Password changed. You've been signed out everywhere else.</Alert>
          <Link to="/login" className="text-sm text-indigo-700 hover:underline">Log in</Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          {!token && <Alert>This link is missing its token. Request a new one.</Alert>}
          {error && <Alert>{error}</Alert>}
          <Field id="password" label="New password" type="password" autoComplete="new-password" minLength={10} required value={password} onChange={(e) => setPassword(e.target.value)} />
          <Field id="confirm" label="Confirm new password" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <button type="submit" disabled={!token} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold rounded-lg py-2.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            Set new password
          </button>
        </form>
      )}
    </AuthCard>
  );
}
