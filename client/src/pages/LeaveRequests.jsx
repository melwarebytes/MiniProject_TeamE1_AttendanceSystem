import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function LeaveRequests({ userRole = 'STUDENT' }) {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  // Form State
  const [form, setForm] = useState({
    sectionId: '',
    startDate: '',
    endDate: '',
    reason: '',
    file: null,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadLeaves();
  }, []);

  async function loadLeaves() {
    try {
      setLoading(true);
      const data = await api.getLeaveRequests();
      setLeaves(data.leaves || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.startDate || !form.endDate || !form.reason || !form.sectionId) {
      return alert('Please fill in all required fields');
    }

    try {
      setSubmitting(true);
      setError(null);
      setMessage(null);

      const formData = new FormData();
      formData.append('sectionId', form.sectionId);
      formData.append('startDate', form.startDate);
      formData.append('endDate', form.endDate);
      formData.append('reason', form.reason);
      if (form.file) {
        formData.append('document', form.file);
      }

      await api.submitLeave(formData);
      setMessage('Leave request submitted successfully. Awaiting faculty/admin approval.');
      setForm({ sectionId: '', startDate: '', endDate: '', reason: '', file: null });
      await loadLeaves();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReview(leaveId, action) {
    try {
      setError(null);
      const res = await api.reviewLeave(leaveId, action, `Reviewed by ${userRole}`);
      setMessage(res.message);
      await loadLeaves();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-800">Leave / Excused Absence Requests (FR-10)</h1>
        <p className="text-sm text-gray-500">
          Submit absence requests with supporting medical/institutional documentation (up to 5MB). Approved leaves convert ABSENT records to EXCUSED.
        </p>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
      {message && <div className="p-4 bg-emerald-50 text-emerald-800 rounded-lg text-sm">{message}</div>}

      {/* Student Submission Form */}
      {userRole === 'STUDENT' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Submit New Leave Request</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="LeaveRequests-field-1" className="text-xs font-semibold text-gray-600">Section ID *</label>
                <input id="LeaveRequests-field-1"
                  type="text"
                  placeholder="e.g. Section UUID"
                  value={form.sectionId}
                  onChange={(e) => setForm({ ...form, sectionId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                  required
                />
              </div>
              <div>
                <label htmlFor="LeaveRequests-field-2" className="text-xs font-semibold text-gray-600">Start Date *</label>
                <input id="LeaveRequests-field-2"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                  required
                />
              </div>
              <div>
                <label htmlFor="LeaveRequests-field-3" className="text-xs font-semibold text-gray-600">End Date *</label>
                <input id="LeaveRequests-field-3"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="LeaveRequests-field-4" className="text-xs font-semibold text-gray-600">Reason for Absence *</label>
              <textarea id="LeaveRequests-field-4"
                placeholder="Explain the medical reason, university event, or emergency..."
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                rows={3}
                required
              />
            </div>

            <div>
              <label htmlFor="LeaveRequests-field-5" className="text-xs font-semibold text-gray-600">Supporting Document (PDF, JPG, PNG ≤ 5MB)</label>
              <input id="LeaveRequests-field-5"
                type="file"
                accept=".pdf,image/jpeg,image/png"
                onChange={(e) => setForm({ ...form, file: e.target.files[0] || null })}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg shadow-sm transition disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Leave Application'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Leave Requests Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-100 font-bold text-gray-700 text-sm">
          {userRole === 'STUDENT' ? 'My Leave Applications' : 'All Student Leave Applications'}
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading leave requests...</div>
        ) : leaves.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No leave requests found.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                <th className="py-3 px-4 border-b">Student</th>
                <th className="py-3 px-4 border-b">Dates</th>
                <th className="py-3 px-4 border-b">Reason</th>
                <th className="py-3 px-4 border-b">Attachment</th>
                <th className="py-3 px-4 border-b">Status</th>
                {userRole !== 'STUDENT' && <th className="py-3 px-4 border-b">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leaves.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-gray-800">{l.user?.name}</div>
                    <div className="text-xs text-gray-500">{l.user?.srn}</div>
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-600">
                    {new Date(l.startDate).toLocaleDateString()} — {new Date(l.endDate).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-700 max-w-xs">{l.reason}</td>
                  <td className="py-3 px-4 text-xs">
                    {l.documentPath ? (
                      <a
                        href={`/${l.documentPath}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:underline font-semibold"
                      >
                        View Proof
                      </a>
                    ) : (
                      <span className="text-gray-400">None</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                        l.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : l.status === 'REJECTED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {l.status}
                    </span>
                  </td>
                  {userRole !== 'STUDENT' && (
                    <td className="py-3 px-4">
                      {l.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReview(l.id, 'APPROVE')}
                            className="text-xs px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReview(l.id, 'REJECT')}
                            className="text-xs px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
