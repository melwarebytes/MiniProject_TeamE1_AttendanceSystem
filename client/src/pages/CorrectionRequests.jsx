import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function CorrectionRequests({ userRole = 'ADMIN' }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [reviewModal, setReviewModal] = useState({ open: false, requestId: null, action: 'APPROVE', reviewNote: '' });

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    try {
      setLoading(true);
      const data = await api.getCorrectionRequests();
      setRequests(data.requests || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleReview() {
    try {
      setError(null);
      await api.reviewCorrection(
        reviewModal.requestId,
        reviewModal.action,
        reviewModal.reviewNote
      );
      setMessage(`Correction request ${reviewModal.action.toLowerCase()}d successfully.`);
      setReviewModal({ open: false, requestId: null, action: 'APPROVE', reviewNote: '' });
      await loadRequests();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-800">Attendance Correction Requests (FR-08)</h1>
        <p className="text-sm text-gray-500">
          Edits within 48h are direct. Past 48h, faculty submits a correction request requiring Admin approval.
        </p>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
      {message && <div className="p-4 bg-emerald-50 text-emerald-800 rounded-lg text-sm">{message}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading requests...</div>
        ) : requests.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No correction requests found.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                <th className="py-3 px-4 border-b">Student</th>
                <th className="py-3 px-4 border-b">Course / Date</th>
                <th className="py-3 px-4 border-b">Change</th>
                <th className="py-3 px-4 border-b">Reason</th>
                <th className="py-3 px-4 border-b">Status</th>
                {userRole === 'ADMIN' && <th className="py-3 px-4 border-b">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requests.map((r) => {
                const student = r.attendanceRecord?.enrollment?.user;
                const session = r.attendanceRecord?.session;
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-800">{student?.name || 'N/A'}</div>
                      <div className="text-xs text-gray-500">{student?.srn}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-600">
                      <div>{session?.section?.course?.code}</div>
                      <div>{session ? new Date(session.date).toLocaleDateString() : 'N/A'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-100 text-red-700 mr-1">
                        {r.oldStatus}
                      </span>
                      →
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 ml-1">
                        {r.newStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-700 max-w-xs">{r.reason}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                          r.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : r.status === 'REJECTED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    {userRole === 'ADMIN' && (
                      <td className="py-3 px-4">
                        {r.status === 'PENDING' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                setReviewModal({
                                  open: true,
                                  requestId: r.id,
                                  action: 'APPROVE',
                                  reviewNote: '',
                                })
                              }
                              className="text-xs px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() =>
                                setReviewModal({
                                  open: true,
                                  requestId: r.id,
                                  action: 'REJECT',
                                  reviewNote: '',
                                })
                              }
                              className="text-xs px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Review Modal */}
      {reviewModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-800">
              {reviewModal.action === 'APPROVE' ? 'Approve Correction Request' : 'Reject Correction Request'}
            </h3>
            <textarea aria-label="Review note"
              placeholder="Review notes (optional)"
              value={reviewModal.reviewNote}
              onChange={(e) => setReviewModal({ ...reviewModal, reviewNote: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              rows={3}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setReviewModal({ open: false, requestId: null, action: 'APPROVE', reviewNote: '' })}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleReview}
                className={`px-4 py-2 text-white text-sm font-semibold rounded-lg shadow-sm ${
                  reviewModal.action === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                Confirm {reviewModal.action}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
