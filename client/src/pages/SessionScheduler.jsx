import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function SessionScheduler() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sectionId, setSectionId] = useState('');
  const [cancelModal, setCancelModal] = useState({ open: false, sessionId: null, reason: '' });
  const [extraModal, setExtraModal] = useState({ open: false, date: '', startTime: '09:00', endTime: '10:00' });
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    try {
      setLoading(true);
      const data = await api.getSessions();
      setSessions(data.sessions || []);
      if (data.sessions && data.sessions.length > 0 && !sectionId) {
        setSectionId(data.sessions[0].sectionId);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
            Generate sessions from weekly timetable (skips holidays), schedule extra classes, or cancel sessions.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            Generate From Timetable
          </button>
          <button
            onClick={() => setExtraModal({ ...extraModal, open: true })}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            + Add Extra Session
          </button>
        </div>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
      {message && <div className="p-4 bg-emerald-50 text-emerald-800 rounded-lg text-sm">{message}</div>}

      {/* Sessions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
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
            {sessions.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="py-3 px-4 font-medium">{new Date(s.date).toLocaleDateString()}</td>
                <td className="py-3 px-4 text-gray-600">{s.startTime} - {s.endTime}</td>
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
                    <span className="block text-xs text-red-500 mt-1 italic">
                      Reason: {s.cancelReason}
                    </span>
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
            <textarea aria-label="Cancellation reason"
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
                <label htmlFor="SessionScheduler-field-1" className="text-xs font-semibold text-gray-600">Date</label>
                <input id="SessionScheduler-field-1"
                  type="date"
                  value={extraModal.date}
                  onChange={(e) => setExtraModal({ ...extraModal, date: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="SessionScheduler-field-2" className="text-xs font-semibold text-gray-600">Start Time</label>
                  <input id="SessionScheduler-field-2"
                    type="time"
                    value={extraModal.startTime}
                    onChange={(e) => setExtraModal({ ...extraModal, startTime: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="SessionScheduler-field-3" className="text-xs font-semibold text-gray-600">End Time</label>
                  <input id="SessionScheduler-field-3"
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
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm"
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
