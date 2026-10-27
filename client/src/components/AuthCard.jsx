import React from 'react';

export default function AuthCard({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6 justify-center">
          <div className="w-11 h-11 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl" aria-hidden="true">
            S
          </div>
          <div>
            <div className="font-bold text-xl text-gray-900 leading-tight">SAMS</div>
            <div className="text-xs text-gray-600">Student Attendance Management System</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        <p className="text-center text-xs text-gray-500 mt-6">PES University · Software Engineering Mini-Project · Team E1</p>
      </div>
    </div>
  );
}

export function Field({ id, label, ...props }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-800 mb-1">
        {label}
      </label>
      <input
        id={id}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        {...props}
      />
    </div>
  );
}

export function Alert({ kind = 'error', children }) {
  const styles = kind === 'error' ? 'bg-red-50 text-red-800 border-red-200' : 'bg-green-50 text-green-800 border-green-200';
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`text-sm border rounded-lg px-3 py-2 ${styles}`}>
      {children}
    </div>
  );
}
