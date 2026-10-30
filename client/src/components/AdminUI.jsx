import React from 'react';
import { api } from '../api';
export const inputClass = 'w-full min-w-0 border border-gray-400 rounded-lg px-3 py-2 bg-white text-gray-900';
export const buttonClass = 'rounded-lg bg-indigo-700 text-white px-4 py-2 font-semibold disabled:opacity-60';
export function Field({ label, children }) {
  return (
    <label className="block text-sm font-medium text-gray-800 space-y-1">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Notice({ error, message }) {
  return (
    <>
      {error && (
        <p role="alert" className="text-red-800 bg-red-50 p-3 rounded">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-green-800 bg-green-50 p-3 rounded">
          {message}
        </p>
      )}
    </>
  );
}
export function Panel({ title, children }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 space-y-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
export async function allPages(endpoint) {
  let result = [],
    page = 1,
    total;
  do {
    const data = await api.request(`${endpoint}${endpoint.includes('?') ? '&' : '?'}size=100&page=${page++}`);
    result.push(...data.data);
    total = data.total;
  } while (result.length < total);
  return result;
}
export const send = (endpoint, method, body) => api.request(endpoint, { method, body: JSON.stringify(body) });
