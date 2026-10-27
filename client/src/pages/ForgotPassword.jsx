import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import AuthCard, { Alert, Field } from '../components/AuthCard';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      await api.requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AuthCard title="Reset your password" subtitle="We'll email you a link that works for 15 minutes.">
      {sent ? (
        <div className="space-y-4">
          <Alert kind="success">If that email is registered, a reset link is on its way.</Alert>
          <Link to="/login" className="text-sm text-indigo-700 hover:underline">Back to log in</Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <Alert>{error}</Alert>}
          <Field id="email" label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg py-2.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            Send reset link
          </button>
          <div className="text-center">
            <Link to="/login" className="text-sm text-indigo-700 hover:underline">Back to log in</Link>
          </div>
        </form>
      )}
    </AuthCard>
  );
}
