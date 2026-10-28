import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function AttendanceMarking() {
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [rosterData, setRosterData] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    try {
      const data = await api.getSessions();
      setSessions(data.sessions || []);
      if (data.sessions && data.sessions.length > 0) {
        setSelectedSessionId(data.sessions[0].id);
        fetchRoster(data.sessions[0].id);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function fetchRoster(sessionId) {
    if (!sessionId) return;
    try {
      setLoading(true);
      setError(null);
      setMessage(null);
      const data = await api.getSessionRoster(sessionId);
      setRosterData(data);
      // Map roster to local records state
      setRecords(
        data.roster.map((r) => ({
          enrollmentId: r.enrollmentId,
          status: r.status || 'PRESENT',
        }))
      );
    } catch (err) {
      setError(err.message);
      setRosterData(null);
    } finally {
      setLoading(false);
    }
  }

  function handleStatusChange(enrollmentId, newStatus) {
    setRecords((prev) =>
      prev.map((item) =>
        item.enrollmentId === enrollmentId ? { ...item, status: newStatus } : item
      )
    );
  }

  function markAllPresent() {
    setRecords((prev) => prev.map((item) => ({ ...item, status: 'PRESENT' })));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      setMessage(null);

      const result = await api.submitRoster(selectedSessionId, records, false);
      await fetchRoster(selectedSessionId);
      setMessage(
        `Attendance successfully submitted! Present: ${result.summary.PRESENT}, Absent: ${result.summary.ABSENT}, Late: ${result.summary.LATE}`
      );

    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header and Session Selector */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Faculty Attendance Roster</h1>
          <p className="text-sm text-gray-500">
            Defaulted to PRESENT. Marking allowed from session start until 23:59 same day.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row min-w-0 gap-3">
          <label htmlFor="session-selector" className="text-xs font-semibold text-gray-600 uppercase">Select Session:</label>
          <select id="session-selector"
            value={selectedSessionId}
            onChange={(e) => {
              setSelectedSessionId(e.target.value);
              fetchRoster(e.target.value);
            }}
            className="min-w-0 max-w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.section?.course?.code} ({s.section?.name}) — {new Date(s.date).toLocaleDateString()} [{s.startTime}-{s.endTime}]
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div role="alert" className="bg-red-50 text-red-700 p-4 rounded-lg text-sm border-l-4 border-red-500">
          {error}
        </div>
      )}

      {message && (
        <div role="status" className="bg-emerald-50 text-emerald-800 p-4 rounded-lg text-sm border-l-4 border-emerald-500">
          {message}
        </div>
      )}

      {/* Roster Table */}
      {loading ? (
        <div className="p-8 text-center text-gray-500 bg-white rounded-xl shadow-sm">Loading roster...</div>
      ) : rosterData ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-700">
              Total Enrolled Students: {rosterData.roster.length}
            </span>
            <button
              type="button"
              onClick={markAllPresent}
              className="text-xs px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-md transition"
            >
              Mark All Present
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 uppercase text-xs font-semibold">
                    <th className="py-3 px-4 border-b">#</th>
                    <th className="py-3 px-4 border-b">SRN</th>
                    <th className="py-3 px-4 border-b">Student Name</th>
                    <th className="py-3 px-4 border-b">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rosterData.roster.map((student, idx) => {
                    const currentRecord = records.find((r) => r.enrollmentId === student.enrollmentId);
                    const currentStatus = currentRecord ? currentRecord.status : 'PRESENT';

                    return (
                      <tr key={student.enrollmentId} className="hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-600 text-xs">{idx + 1}</td>
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-gray-700">{student.srn || 'N/A'}</td>
                        <td className="py-3 px-4 font-medium text-gray-800">{student.studentName}</td>
                        <td className="py-3 px-4">
                          <div className="inline-flex rounded-md shadow-sm" role="group" aria-label={`Attendance for ${student.studentName}`}>
                            <button
                              type="button"
                              aria-pressed={currentStatus === 'PRESENT'}
                              onClick={() => handleStatusChange(student.enrollmentId, 'PRESENT')}
                              className={`px-3 py-1 text-xs font-semibold rounded-l-md border ${
                                currentStatus === 'PRESENT'
                                  ? 'bg-emerald-700 text-white border-emerald-700'
                                  : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
                              }`}
                            >
                              Present
                            </button>
                            <button
                              type="button"
                              aria-pressed={currentStatus === 'LATE'}
                              onClick={() => handleStatusChange(student.enrollmentId, 'LATE')}
                              className={`px-3 py-1 text-xs font-semibold border-t border-b ${
                                currentStatus === 'LATE'
                                  ? 'bg-amber-800 text-white border-amber-800'
                                  : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
                              }`}
                            >
                              Late
                            </button>
                            <button
                              type="button"
                              aria-pressed={currentStatus === 'ABSENT'}
                              onClick={() => handleStatusChange(student.enrollmentId, 'ABSENT')}
                              className={`px-3 py-1 text-xs font-semibold rounded-r-md border ${
                                currentStatus === 'ABSENT'
                                  ? 'bg-red-600 text-white border-red-600'
                                  : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
                              }`}
                            >
                              Absent
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
              >
                {submitting ? 'Submitting Roster...' : 'Save & Submit Attendance'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
