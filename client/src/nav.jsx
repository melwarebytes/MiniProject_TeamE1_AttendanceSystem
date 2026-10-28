import UserManagement from './pages/UserManagement';
import CourseManagement from './pages/CourseManagement';
import PolicySettings from './pages/PolicySettings';
import Reports from './pages/Reports';
import React from 'react';
import StudentDashboard from './pages/StudentDashboard';
import AttendanceMarking from './pages/AttendanceMarking';
import SessionScheduler from './pages/SessionScheduler';
import CorrectionRequests from './pages/CorrectionRequests';
import LeaveRequests from './pages/LeaveRequests';
import DefaultersList from './pages/DefaultersList';
import QrSession from './pages/QrSession';
import QrCheckIn from './pages/QrCheckIn';
import AuditLog from './pages/AuditLog';

// One entry per screen. `roles` controls who sees it in the menu and who may open it.
// The first entry a role can see is that role's landing page.
export const NAV = [
  { path: '/users', label: 'Users', roles: ['ADMIN'], render: () => <UserManagement /> },
  { path: '/courses', label: 'Courses & Enrolments', roles: ['ADMIN'], render: () => <CourseManagement /> },
  { path: '/reports', label: 'Reports', roles: ['ADMIN', 'FACULTY'], render: () => <Reports /> },
  { path: '/policies', label: 'Policy', roles: ['ADMIN'], render: () => <PolicySettings /> },
  { path: '/dashboard', label: 'My Attendance', roles: ['STUDENT'], render: () => <StudentDashboard /> },
  { path: '/check-in', label: 'Check In', roles: ['STUDENT'], render: () => <QrCheckIn /> },
  { path: '/mark', label: 'Mark Attendance', roles: ['FACULTY'], render: () => <AttendanceMarking /> },
  { path: '/qr', label: 'QR Check-in', roles: ['FACULTY'], render: () => <QrSession /> },
  { path: '/sessions', label: 'Sessions & Timetable', roles: ['FACULTY', 'ADMIN'], render: () => <SessionScheduler /> },
  { path: '/corrections', label: 'Corrections', roles: ['FACULTY', 'ADMIN'], render: (role) => <CorrectionRequests userRole={role} /> },
  { path: '/leave', label: 'Leave', roles: ['STUDENT', 'FACULTY', 'ADMIN'], render: (role) => <LeaveRequests userRole={role} /> },
  { path: '/defaulters', label: 'Defaulters', roles: ['FACULTY', 'ADMIN'], render: () => <DefaultersList /> },
  { path: '/audit', label: 'Audit Log', roles: ['ADMIN'], render: () => <AuditLog /> },
];

export const navFor = (role) => NAV.filter((item) => item.roles.includes(role));
