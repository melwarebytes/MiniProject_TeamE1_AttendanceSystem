import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { allPages, send } from '../components/AdminUI';

export default function SessionScheduler() {
  const [sessions, setSessions] = useState([]);
  const [sections, setSections] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sectionId, setSectionId] = useState('');
  const [cancelModal, setCancelModal] = useState({ open: false, sessionId: null, reason: '' });
  const [extraModal, setExtraModal] = useState({
    open: false,
    date: '',
    startTime: '09:00',
    endTime: '10:00',
  });
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSessions();
    allPages('/sections')
      .then((rows) => {
        setSections(rows);
        setSectionId(rows[0]?.id || '');
        setSlots(rows[0]?.timetable || []);
      })
      .catch((err) => setError(err.message));
  }, []);

  async function loadSessions() {
    try {
      setLoading(true);
      const data = await api.getSessions();
      setSessions(data.sessions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveTimetable() {
    try {
      const saved = await send(`/sections/${sectionId}/timetable`, 'PUT', { slots });
      setSections((rows) => rows.map((row) => (row.id === sectionId ? { ...row, timetable: saved } : row)));
      setMessage(
        'Weekly timetable saved. Generate sessions to add missing classes; existing sessions are preserved.',
      );
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleGenerate() {
    if (!sectionId) return alert('Please enter or select a Section ID');
    try {
      setLoading(true);
      setError(null);
      const res = await api.generateSessions(sectionId);
      setMessage(res.message);
      await loadSessions();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelSession() {
    if (!cancelModal.reason.trim()) return alert('Please provide a reason for cancellation');
    try {
      setError(null);
      await api.cancelSession(cancelModal.sessionId, cancelModal.reason);
      setMessage('Session successfully cancelled');
      setCancelModal({ open: false, sessionId: null, reason: '' });
      await loadSessions();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddExtraSession() {
    if (!extraModal.date || !extraModal.startTime || !extraModal.endTime) {
      return alert('Please fill in date and times');
    }
    try {
      setError(null);
      await api.addExtraSession({
        sectionId,
        date: extraModal.date,
        startTime: extraModal.startTime,
        endTime: extraModal.endTime,
      });
      setMessage('Extra session added');
      setExtraModal({ open: false, date: '', startTime: '09:00', endTime: '10:00' });
      await loadSessions();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Class Session Scheduling (FR-05)</h1>
          <p className="text-sm text-gray-500">
            Generate sessions from weekly timetable (skips holidays), schedule extra classes, or cancel
            sessions.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleGenerate}
            disabled={loading || !sectionId}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            Generate From Timetable
          </button>
          <button
            disabled={!sectionId}
            onClick={() => setExtraModal({ ...extraModal, open: true })}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            + Add Extra Session
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="p-4 bg-emerald-50 text-emerald-800 rounded-lg text-sm">
          {message}
        </div>
      )}

      <section className="bg-white p-4 rounded-xl space-y-4" aria-label="Weekly timetable">
        <label className="block">
          Section
          <select
            className="block border rounded p-2 w-full"
            value={sectionId}
            onChange={(e) => {
              setSectionId(e.target.value);
              setSlots(sections.find((row) => row.id === e.target.value)?.timetable || []);
            }}
          >
            {!sections.length && <option value="">No assigned sections</option>}
            {sections.map((row) => (
              <option key={row.id} value={row.id}>
                {row.course?.code} / {row.name}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm text-gray-600">
          Weekly class times (IST). Saving changes the template; generating adds missing sessions and
          preserves existing classes and attendance.
        </p>
        {slots.map((slot, i) => (
          <div key={i} className="flex flex-wrap gap-2 items-end">
            <label>
              Day
              <select
                className="block border rounded p-2"
                value={slot.dayOfWeek}
                onChange={(e) =>
                  setSlots((rows) => rows.map((r, j) => (j === i ? { ...r, dayOfWeek: e.target.value } : r)))
                }
              >
                {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            <label>
              Start
              <input
                className="block border rounded p-2"
                type="time"
                value={slot.startTime}
                onChange={(e) =>
                  setSlots((rows) => rows.map((r, j) => (j === i ? { ...r, startTime: e.target.value } : r)))
                }
              />
            </label>
            <label>
              End
              <input
                className="block border rounded p-2"
                type="time"
                value={slot.endTime}
                onChange={(e) =>
                  setSlots((rows) => rows.map((r, j) => (j === i ? { ...r, endTime: e.target.value } : r)))
                }
              />
            </label>
            <button
              className="p-2 text-red-700"
              aria-label={`Remove weekly slot ${i + 1}`}
              onClick={() => setSlots((rows) => rows.filter((_, j) => j !== i))}
            >
              Remove
            </button>
          </div>
        ))}
        <div className="flex flex-wrap gap-3">
          <button
            className="border rounded p-2"
            disabled={!sectionId || slots.length >= 30}
            onClick={() =>
              setSlots((rows) => [...rows, { dayOfWeek: 'MON', startTime: '09:00', endTime: '10:00' }])
            }
          >
            Add weekly slot
          </button>
          <button
            className="bg-indigo-600 text-white rounded p-2"
            disabled={!sectionId}
            onClick={saveTimetable}
          >
            Save timetable
          </button>
        </div>
      </section>
      {/* Sessions Table */}
      <div
        role="region"
        aria-label="Class sessions"
        tabIndex={0}
        className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto"
      >
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
              <th className="py-3 px-4 border-b">Date</th>
              <th className="py-3 px-4 border-b">Time</th>
              <th className="py-3 px-4 border-b">Course / Section</th>
              <th className="py-3 px-4 border-b">Status</th>
              <th className="py-3 px-4 border-b">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sessions
              .filter((s) => !sectionId || s.sectionId === sectionId)
              .map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">{new Date(s.date).toLocaleDateString()}</td>
                  <td className="py-3 px-4 text-gray-600">
                    {s.startTime} - {s.endTime}
                  </td>
                  <td className="py-3 px-4">
                    {s.section?.course?.code} ({s.section?.name})
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                        s.status === 'SCHEDULED'
                          ? 'bg-blue-100 text-blue-800'
                          : s.status === 'EXTRA'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {s.status}
                    </span>
                    {s.cancelReason && (
                      <span className="block text-xs text-red-700 mt-1 italic">Reason: {s.cancelReason}</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {s.status !== 'CANCELLED' && (
                      <button
                        onClick={() => setCancelModal({ open: true, sessionId: s.id, reason: '' })}
                        className="text-xs text-red-600 hover:text-red-800 font-semibold"
                      >
                        Cancel Session
                      </button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Cancel Modal */}
      {cancelModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-800">Cancel Class Session</h3>
            <p className="text-xs text-gray-500">
              Cancelled sessions are excluded from attendance percentage calculations.
            </p>
            <textarea
              aria-label="Cancellation reason"
              placeholder="Reason for cancellation (e.g. Faculty medical leave, guest lecture rescheduled)"
              value={cancelModal.reason}
              onChange={(e) => setCancelModal({ ...cancelModal, reason: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
              rows={3}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setCancelModal({ open: false, sessionId: null, reason: '' })}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Close
              </button>
              <button
                onClick={handleCancelSession}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg shadow-sm"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extra Session Modal */}
      {extraModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-800">Schedule Extra Class Session</h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="SessionScheduler-field-1" className="text-xs font-semibold text-gray-600">
                  Date
                </label>
                <input
                  id="SessionScheduler-field-1"
                  type="date"
                  value={extraModal.date}
                  onChange={(e) => setExtraModal({ ...extraModal, date: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="SessionScheduler-field-2" className="text-xs font-semibold text-gray-600">
                    Start Time
                  </label>
                  <input
                    id="SessionScheduler-field-2"
                    type="time"
                    value={extraModal.startTime}
                    onChange={(e) => setExtraModal({ ...extraModal, startTime: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="SessionScheduler-field-3" className="text-xs font-semibold text-gray-600">
                    End Time
                  </label>
                  <input
                    id="SessionScheduler-field-3"
                    type="time"
                    value={extraModal.endTime}
                    onChange={(e) => setExtraModal({ ...extraModal, endTime: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setExtraModal({ open: false, date: '', startTime: '09:00', endTime: '10:00' })}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddExtraSession}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold rounded-lg shadow-sm"
              >
                Add Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
