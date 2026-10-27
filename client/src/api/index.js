const BASE_URL = '/api/v1';

function getAuthHeader() {
  const token = localStorage.getItem('sams_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(endpoint, options = {}) {
  const headers = {
    ...getAuthHeader(),
    ...(options.headers || {}),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || 'API Request Failed');
    error.status = response.status;
    error.code = data.code;
    throw error;
  }

  return data;
}

export const api = {
  // Auth
  login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),

  // FR-05: Sessions
  generateSessions: (sectionId) => request('/sessions/generate', { method: 'POST', body: JSON.stringify({ sectionId }) }),
  addExtraSession: (payload) => request('/sessions/extra', { method: 'POST', body: JSON.stringify(payload) }),
  cancelSession: (sessionId, reason) => request(`/sessions/${sessionId}/cancel`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
  getSessions: (params = '') => request(`/sessions?${params}`),

  // FR-06: Attendance Marking
  getSessionRoster: (sessionId) => request(`/attendance/roster/${sessionId}`),
  submitRoster: (sessionId, records, bypass = false) =>
    request(`/attendance/roster/${sessionId}`, {
      method: 'POST',
      body: JSON.stringify({ records, bypassTimeWindow: bypass }),
    }),

  // FR-09: Student Dashboard
  getStudentDashboard: () => request('/dashboard/student'),
  getStudentDashboardById: (id) => request(`/dashboard/student/${id}`),

  // FR-08: Corrections
  correctDirectly: (recordId, newStatus, reason) =>
    request(`/corrections/direct/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify({ newStatus, reason }),
    }),
  requestCorrection: (payload) =>
    request('/corrections/request', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getCorrectionRequests: (params = '') => request(`/corrections?${params}`),
  reviewCorrection: (id, action, reviewNote) =>
    request(`/corrections/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ action, reviewNote }),
    }),

  // FR-10: Leave Requests
  submitLeave: (formData) =>
    request('/leave', {
      method: 'POST',
      body: formData, // FormData for file upload
    }),
  getLeaveRequests: (params = '') => request(`/leave?${params}`),
  reviewLeave: (id, action, reviewNote) =>
    request(`/leave/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ action, reviewNote }),
    }),

  // FR-11: Alerts
  getDefaulters: (sectionId) => request(`/alerts/defaulters/${sectionId}`),
  getMyAlerts: () => request('/alerts/my'),
  markAlertRead: (id) => request(`/alerts/${id}/read`, { method: 'PATCH' }),
};
