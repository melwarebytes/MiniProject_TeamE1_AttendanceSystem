import React from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { navFor } from './nav';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

const ROLE_LABEL = { STUDENT: 'Student', FACULTY: 'Faculty', ADMIN: 'Administrator' };

function Shell() {
  const { user, logout } = useAuth();
  const items = navFor(user.role);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-white px-3 py-2 rounded shadow z-50">
        Skip to content
      </a>
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-lg" aria-hidden="true">
              S
            </div>
            <div>
              <span className="font-bold text-gray-900 tracking-tight">SAMS</span>
              <span className="hidden sm:inline text-xs text-indigo-700 font-semibold ml-2 px-2 py-0.5 bg-indigo-50 rounded">
                PES Team E1
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="text-right leading-tight">
              <div className="font-semibold text-gray-900">{user.name}</div>
              <div className="text-xs text-gray-600">{ROLE_LABEL[user.role]}</div>
            </div>
            <button
              onClick={logout}
              className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Log out
            </button>
          </div>
        </div>
        <nav aria-label="Main" className="max-w-7xl mx-auto px-4 flex gap-6 overflow-x-auto text-sm border-t border-gray-100">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `py-3 whitespace-nowrap font-semibold border-b-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  isActive ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-600 hover:text-gray-900'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main id="main" className="flex-1 py-8">
        <Routes>
          {items.map((item) => (
            <Route key={item.path} path={item.path} element={item.render(user.role)} />
          ))}
          <Route path="*" element={<Navigate to={items[0]?.path || '/'} replace />} />
        </Routes>
      </main>

      <footer className="bg-white border-t border-gray-200 py-4 text-center text-xs text-gray-600">
        SAMS Student Attendance Management System • MiniProject Team E1 • PES University
      </footer>
    </div>
  );
}

function Gate() {
  const { user, ready } = useAuth();
  if (!ready) {
    return <div className="min-h-screen flex items-center justify-center text-gray-600">Loading…</div>;
  }
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Shell />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </BrowserRouter>
  );
}
