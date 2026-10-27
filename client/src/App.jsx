import React, { useState } from 'react';
import StudentDashboard from './pages/StudentDashboard';
import AttendanceMarking from './pages/AttendanceMarking';
import SessionScheduler from './pages/SessionScheduler';
import CorrectionRequests from './pages/CorrectionRequests';
import LeaveRequests from './pages/LeaveRequests';
import DefaultersList from './pages/DefaultersList';

export default function App() {
  const [activeTab, setActiveTab] = useState('student-dashboard');
  const [currentRole, setCurrentRole] = useState('STUDENT'); // 'STUDENT' | 'FACULTY' | 'ADMIN'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-lg">
              S
            </div>
            <div>
              <span className="font-bold text-gray-900 tracking-tight">SAMS</span>
              <span className="text-xs text-indigo-600 font-semibold ml-2 px-2 py-0.5 bg-indigo-50 rounded">
                PES Team E1
              </span>
            </div>
          </div>

          {/* Quick Demo Role Switcher */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-400 uppercase">Simulate Role:</span>
            <select
              value={currentRole}
              onChange={(e) => {
                const role = e.target.value;
                setCurrentRole(role);
                if (role === 'STUDENT') setActiveTab('student-dashboard');
                else if (role === 'FACULTY') setActiveTab('attendance-marking');
                else if (role === 'ADMIN') setActiveTab('correction-requests');
              }}
              className="text-xs font-semibold border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none"
            >
              <option value="STUDENT">Student (Bhuvan)</option>
              <option value="FACULTY">Faculty Member</option>
              <option value="ADMIN">Administrator</option>
            </select>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 flex gap-6 overflow-x-auto text-sm border-t border-gray-100">
          {currentRole === 'STUDENT' && (
            <>
              <button
                onClick={() => setActiveTab('student-dashboard')}
                className={`py-3 font-semibold border-b-2 transition ${
                  activeTab === 'student-dashboard'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                [FR-09] My Attendance Dashboard
              </button>
              <button
                onClick={() => setActiveTab('leave-requests')}
                className={`py-3 font-semibold border-b-2 transition ${
                  activeTab === 'leave-requests'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                [FR-10] Leave Requests
              </button>
            </>
          )}

          {currentRole === 'FACULTY' && (
            <>
              <button
                onClick={() => setActiveTab('attendance-marking')}
                className={`py-3 font-semibold border-b-2 transition ${
                  activeTab === 'attendance-marking'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                [FR-06] Mark Attendance
              </button>
              <button
                onClick={() => setActiveTab('session-scheduler')}
                className={`py-3 font-semibold border-b-2 transition ${
                  activeTab === 'session-scheduler'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                [FR-05] Sessions & Timetable
              </button>
              <button
                onClick={() => setActiveTab('correction-requests')}
                className={`py-3 font-semibold border-b-2 transition ${
                  activeTab === 'correction-requests'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                [FR-08] Correction Requests
              </button>
              <button
                onClick={() => setActiveTab('defaulters-list')}
                className={`py-3 font-semibold border-b-2 transition ${
                  activeTab === 'defaulters-list'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                [FR-11] Defaulters List
              </button>
              <button
                onClick={() => setActiveTab('leave-requests')}
                className={`py-3 font-semibold border-b-2 transition ${
                  activeTab === 'leave-requests'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                [FR-10] Review Leaves
              </button>
            </>
          )}

          {currentRole === 'ADMIN' && (
            <>
              <button
                onClick={() => setActiveTab('correction-requests')}
                className={`py-3 font-semibold border-b-2 transition ${
                  activeTab === 'correction-requests'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                [FR-08] Approve Corrections
              </button>
              <button
                onClick={() => setActiveTab('session-scheduler')}
                className={`py-3 font-semibold border-b-2 transition ${
                  activeTab === 'session-scheduler'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                [FR-05] Timetable & Sessions
              </button>
              <button
                onClick={() => setActiveTab('leave-requests')}
                className={`py-3 font-semibold border-b-2 transition ${
                  activeTab === 'leave-requests'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                [FR-10] Review Leaves
              </button>
              <button
                onClick={() => setActiveTab('defaulters-list')}
                className={`py-3 font-semibold border-b-2 transition ${
                  activeTab === 'defaulters-list'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                [FR-11] Defaulters List
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 py-8">
        {activeTab === 'student-dashboard' && <StudentDashboard />}
        {activeTab === 'attendance-marking' && <AttendanceMarking />}
        {activeTab === 'session-scheduler' && <SessionScheduler />}
        {activeTab === 'correction-requests' && <CorrectionRequests userRole={currentRole} />}
        {activeTab === 'leave-requests' && <LeaveRequests userRole={currentRole} />}
        {activeTab === 'defaulters-list' && <DefaultersList />}
      </main>

      <footer className="bg-white border-t border-gray-200 py-4 text-center text-xs text-gray-400">
        SAMS Student Attendance Management System • MiniProject Team E1 • PES University
      </footer>
    </div>
  );
}
