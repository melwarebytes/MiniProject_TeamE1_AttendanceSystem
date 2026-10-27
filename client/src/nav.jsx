import React from 'react';
import StudentDashboard from './pages/StudentDashboard';
import AttendanceMarking from './pages/AttendanceMarking';
import SessionScheduler from './pages/SessionScheduler';
import CorrectionRequests from './pages/CorrectionRequests';
import LeaveRequests from './pages/LeaveRequests';
import DefaultersList from './pages/DefaultersList';

// One entry per screen. `roles` controls who sees it in the menu and who may open it.
// The first entry a role can see is that role's landing page.
export const NAV = [
  { path: '/dashboard', label: 'My Attendance', roles: ['STUDENT'], render: () => <StudentDashboard /> },
  { path: '/mark', label: 'Mark Attendance', roles: ['FACULTY'], render: () => <AttendanceMarking /> },
  { path: '/sessions', label: 'Sessions & Timetable', roles: ['FACULTY', 'ADMIN'], render: () => <SessionScheduler /> },
  { path: '/corrections', label: 'Corrections', roles: ['FACULTY', 'ADMIN'], render: (role) => <CorrectionRequests userRole={role} /> },
  { path: '/leave', label: 'Leave', roles: ['STUDENT', 'FACULTY', 'ADMIN'], render: (role) => <LeaveRequests userRole={role} /> },
  { path: '/defaulters', label: 'Defaulters', roles: ['FACULTY', 'ADMIN'], render: () => <DefaultersList /> },
];

export const navFor = (role) => NAV.filter((item) => item.roles.includes(role));
