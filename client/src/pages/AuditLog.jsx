import React, { useEffect, useState } from 'react';
import { api } from '../api';

const PAGE_SIZE = 25;

function Details({ entry }) {
  const [open, setOpen] = useState(false);
  if (!entry.oldValue && !entry.newValue) return <span className="text-gray-400">—</span>;
  return (
    <div>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="text-xs text-indigo-700 hover:underline">
        {open ? 'Hide' : 'Show'}
      </button>
      {open && (
        <div className="mt-2 grid gap-2 text-[11px] font-mono">
          {entry.oldValue && (
            <pre className="bg-red-50 text-red-900 p-2 rounded overflow-x-auto max-w-md whitespace-pre-wrap">before: {JSON.stringify(entry.oldValue, null, 1)}</pre>
          )}
          {entry.newValue && (
            <pre className="bg-emerald-50 text-emerald-900 p-2 rounded overflow-x-auto max-w-md whitespace-pre-wrap">after: {JSON.stringify(entry.newValue, null, 1)}</pre>
          )}
        </div>
      )}
    </div>
  );
}

export default function AuditLog() {
  const [filters, setFilters] = useState({ actor: '', action: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ data: [], total: 0, actions: [] });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function load(p = page, f = filters) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), size: String(PAGE_SIZE) });
      Object.entries(f).forEach(([k, v]) => v && params.set(k, v));
      setData(await api.auditLogs(params.toString()));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-800">Audit Log</h1>
        <p className="text-sm text-gray-600">
          Every login, attendance change, approval and configuration change, with who did it and when. Entries are read-only and cannot be edited or deleted.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            load(1);
          }}
          className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end"
        >
          <div>
            <label htmlFor="f-actor" className="block text-xs font-semibold text-gray-700 mb-1">Actor (name or email)</label>
            <input id="f-actor" value={filters.actor} onChange={set('actor')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="f-action" className="block text-xs font-semibold text-gray-700 mb-1">Action</label>
            <select id="f-action" value={filters.action} onChange={set('action')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="">All actions</option>
              {data.actions.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-from" className="block text-xs font-semibold text-gray-700 mb-1">From</label>
            <input id="f-from" type="date" value={filters.from} onChange={set('from')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="f-to" className="block text-xs font-semibold text-gray-700 mb-1">To</label>
            <input id="f-to" type="date" value={filters.to} onChange={set('to')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg">Search</button>
            <button
              type="button"
              onClick={() => {
                const cleared = { actor: '', action: '', from: '', to: '' };
                setFilters(cleared);
                setPage(1);
                load(1, cleared);
              }}
              className="px-3 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50"
            >
              Clear
            </button>
          </div>
        </form>
      </div>

      {error && <div role="alert" className="p-4 bg-red-50 text-red-800 rounded-lg text-sm">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Audit log entries, newest first</caption>
          <thead>
            <tr className="bg-gray-50 text-gray-700 text-xs uppercase font-semibold">
              <th scope="col" className="py-3 px-4 border-b">When</th>
              <th scope="col" className="py-3 px-4 border-b">Actor</th>
              <th scope="col" className="py-3 px-4 border-b">Action</th>
              <th scope="col" className="py-3 px-4 border-b">Entity</th>
              <th scope="col" className="py-3 px-4 border-b">IP</th>
              <th scope="col" className="py-3 px-4 border-b">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.data.map((e) => (
              <tr key={e.id} className="align-top hover:bg-gray-50">
                <td className="py-3 px-4 whitespace-nowrap text-gray-800 tabular-nums">
                  {new Date(e.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </td>
                <td className="py-3 px-4">
                  {e.actor ? (
                    <>
                      <div className="font-medium text-gray-900">{e.actor.name}</div>
                      <div className="text-xs text-gray-600">{e.actor.email} · {e.actor.role.toLowerCase()}</div>
                    </>
                  ) : (
                    <span className="text-gray-600">System / unknown</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <span className={`text-xs font-semibold px-2 py-1 rounded ${/FAILED|DENIED|LOCKED|REJECTED|BLOCKED/.test(e.action) ? 'bg-red-50 text-red-800' : 'bg-indigo-50 text-indigo-800'}`}>{e.action}</span>
                </td>
                <td className="py-3 px-4 text-gray-700">
                  <div>{e.entity}</div>
                  <div className="text-[11px] font-mono text-gray-500 truncate max-w-[12rem]" title={e.entityId}>{e.entityId}</div>
                </td>
                <td className="py-3 px-4 text-xs font-mono text-gray-600">{e.ip || '—'}</td>
                <td className="py-3 px-4"><Details entry={e} /></td>
              </tr>
            ))}
            {!loading && data.data.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-600">No entries match these filters.</td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-700">
          <span>{data.total} {data.total === 1 ? 'entry' : 'entries'} · page {page} of {pages}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => { setPage(page - 1); load(page - 1); }} className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40">Previous</button>
            <button disabled={page >= pages} onClick={() => { setPage(page + 1); load(page + 1); }} className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
