const BASE_URL = '/api/v1';

// The access token lives in memory only (SR-07). On reload the session is restored
// from the HttpOnly refresh cookie via /auth/refresh.
let accessToken = null;
let onSessionExpired = () => {};
let refreshing = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function setSessionExpiredHandler(fn) {
  onSessionExpired = fn;
}

async function refreshSession() {
  if (!refreshing) {
    refreshing = fetch(`${BASE_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error('refresh failed');
        const data = await res.json();
        accessToken = data.accessToken;
        return data;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

async function request(endpoint, options = {}, retried = false) {
  const headers = { ...(options.headers || {}) };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers, credentials: 'include' });

  // Access token expired: refresh once and retry (SADS §11.3, frontend)
  if (response.status === 401 && !retried && !endpoint.startsWith('/auth/')) {
    try {
      await refreshSession();
      return request(endpoint, options, true);
    } catch (e) {
      accessToken = null;
      onSessionExpired();
    }
  }

  if (response.status === 204) return {};
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (!response.ok) throw Object.assign(new Error('API Request Failed'), { status: response.status });
    return response;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || data.detail || 'API Request Failed');
    error.status = response.status;
    error.code = data.code;
    error.errors = data.errors;
    throw error;
  }
  return data;
}

export const api = {
  request,
  refreshSession,

  // Auth (FR-01, FR-02)
  login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  requestPasswordReset: (email) =>
    request('/auth/password-reset/request', { method: 'POST', body: JSON.stringify({ email }) }),
  confirmPasswordReset: (token, password) =>
    request('/auth/password-reset/confirm', { method: 'POST', body: JSON.stringify({ token, password }) }),

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
