import React, { useState } from 'react';
import { api } from '../api';

export default function DefaultersList() {
  const [sectionId, setSectionId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  async function handleSearch(e) {
    e.preventDefault();
    if (!sectionId.trim()) return;

    try {
      setLoading(true);
      setError(null);
      setMessage(null);
      const res = await api.getDefaulters(sectionId);
      setData(res);
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleTriggerAlerts() {
    try {
      setError(null);
      const res = await api.request(`/alerts/trigger/${sectionId}`, { method: 'POST' });
      setMessage(res.message);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Low Attendance Defaulters List (FR-11)</h1>
          <p className="text-sm text-gray-500">
            Identify students currently below the minimum required attendance threshold (default 75%).
          </p>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input aria-label="Section ID"
            type="text"
            placeholder="Enter Section ID"
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg shadow-sm"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
      {message && <div className="p-4 bg-emerald-50 text-emerald-800 rounded-lg text-sm">{message}</div>}

      {data && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden space-y-4 p-6">
          <div className="flex justify-between items-center pb-4 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-bold text-gray-800">
                {data.courseCode} — {data.courseName} (Section {data.sectionName})
              </h2>
              <p className="text-xs text-gray-500">
                Threshold: <strong>{data.threshold}%</strong> • Total Students Below Threshold:{' '}
                <strong className="text-red-600">{data.totalDefaulters}</strong>
              </p>
            </div>
            {data.totalDefaulters > 0 && (
              <button
                onClick={handleTriggerAlerts}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-sm"
              >
                Dispatch Low-Attendance Warning Alerts
              </button>
            )}
          </div>

          {data.students.length === 0 ? (
            <div className="p-8 text-center text-emerald-600 font-semibold">
              🎉 No students are currently below the attendance threshold!
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                  <th className="py-3 px-4 border-b">SRN</th>
                  <th className="py-3 px-4 border-b">Student Name</th>
                  <th className="py-3 px-4 border-b">Email</th>
                  <th className="py-3 px-4 border-b">Held / Attended</th>
                  <th className="py-3 px-4 border-b">Percentage</th>
                  <th className="py-3 px-4 border-b">Classes Needed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.students.map((st) => (
                  <tr key={st.studentId} className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono font-semibold text-xs text-gray-700">{st.srn}</td>
                    <td className="py-3 px-4 font-medium text-gray-800">{st.name}</td>
                    <td className="py-3 px-4 text-xs text-gray-500">{st.email}</td>
                    <td className="py-3 px-4 text-xs text-gray-600">
                      {st.attended} / {st.held}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-red-100 text-red-700">
                        {st.percentage}%
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded">
                        +{st.classesToRecover} consecutive classes
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
