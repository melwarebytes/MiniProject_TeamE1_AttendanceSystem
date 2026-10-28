import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function StudentDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [dashData, alertData] = await Promise.all([
        api.getStudentDashboard(),
        api.getMyAlerts(),
      ]);
      setDashboard(dashData);
      setAlerts(alertData.alerts || []);
      if (dashData.courses && dashData.courses.length > 0) {
        setSelectedCourse(dashData.courses[0]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-600">Loading student attendance dashboard...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-600">Error: {error}</div>;
  }

  const { student, overall, courses } = dashboard;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Welcome, {student.name}</h1>
          <p className="text-sm text-gray-500">SRN: {student.srn || 'N/A'} • {student.email}</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black text-indigo-600">{overall.overallPercentage}%</div>
          <div className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Overall Attendance</div>
        </div>
      </div>

      {/* Low Attendance In-App Alerts Banner (FR-11) */}
      {alerts.length > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-amber-800">Attendance Warning Notices</h3>
              <ul className="mt-1 text-sm text-amber-700 list-disc list-inside space-y-1">
                {alerts.map((a) => (
                  <li key={a.id}>
                    Your attendance dropped to <strong>{a.percentage}%</strong> (Required minimum: {a.threshold}%).
                    Issued on {new Date(a.sentAt).toLocaleDateString()}.
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Course Cards Grid (FR-09) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {courses.map((course) => {
          const { stats } = course;
          const isWarning = stats.isLowAttendance;
          const isSelected = selectedCourse?.courseId === course.courseId;

          return (
            <div
              key={course.courseId}
              role="button" tabIndex={0} aria-pressed={isSelected}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCourse(course); } }}
              onClick={() => setSelectedCourse(course)}
              className={`cursor-pointer transition-all duration-200 bg-white p-5 rounded-xl border-2 shadow-sm ${
                isSelected
                  ? 'border-indigo-600 ring-2 ring-indigo-100'
                  : 'border-transparent hover:border-gray-200'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="inline-block px-2 py-0.5 text-xs font-bold bg-indigo-50 text-indigo-700 rounded mb-1">
                    {course.courseCode} • Sec {course.sectionName}
                  </span>
                  <h2 className="font-semibold text-gray-800 leading-tight">{course.courseName}</h2>
                </div>
                <div
                  className={`text-xl font-black px-2.5 py-1 rounded-lg ${
                    isWarning ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                  }`}
                >
                  {stats.percentage}%
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4 w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isWarning ? 'bg-red-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, stats.percentage)}%` }}
                />
              </div>

              {/* Attendance metrics */}
              <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
                <span>Attended: <strong>{stats.attended}/{stats.totalHeld}</strong></span>
                {isWarning ? (
                  <span className="text-red-600 font-bold">
                    Need {stats.classesToRecover} more class(es)
                  </span>
                ) : (
                  <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                    Can miss {stats.canStillMiss} class(es)
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Course Session History (FR-09) */}
      {selectedCourse && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-800">
                Session History — {selectedCourse.courseCode}: {selectedCourse.courseName}
              </h2>
              <p className="text-xs text-gray-500">
                Threshold: {selectedCourse.threshold}% • Total Sessions Held: {selectedCourse.stats.totalHeld}
              </p>
            </div>
            <div className="flex gap-2 text-xs">
              <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-800 font-medium">Present: {selectedCourse.stats.present}</span>
              <span className="px-2 py-1 rounded bg-amber-100 text-amber-800 font-medium">Late: {selectedCourse.stats.late}</span>
              <span className="px-2 py-1 rounded bg-blue-100 text-blue-800 font-medium">Excused: {selectedCourse.stats.excused}</span>
              <span className="px-2 py-1 rounded bg-red-100 text-red-800 font-medium">Absent: {selectedCourse.stats.absent}</span>
            </div>
          </div>

          <div role="region" aria-label="Scrollable table" tabIndex={0} className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-xs uppercase font-semibold">
                  <th className="py-2.5 px-3 border-b">Date</th>
                  <th className="py-2.5 px-3 border-b">Time</th>
                  <th className="py-2.5 px-3 border-b">Session Status</th>
                  <th className="py-2.5 px-3 border-b">Attendance</th>
                  <th className="py-2.5 px-3 border-b">Marked At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {selectedCourse.sessionHistory.map((s, idx) => {
                  let badgeClass = 'bg-gray-100 text-gray-700';
                  if (s.attendanceStatus === 'PRESENT') badgeClass = 'bg-emerald-100 text-emerald-800';
                  else if (s.attendanceStatus === 'ABSENT') badgeClass = 'bg-red-100 text-red-800 font-bold';
                  else if (s.attendanceStatus === 'LATE') badgeClass = 'bg-amber-100 text-amber-800';
                  else if (s.attendanceStatus === 'EXCUSED') badgeClass = 'bg-blue-100 text-blue-800 font-semibold';

                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-2.5 px-3">{new Date(s.date).toLocaleDateString()}</td>
                      <td className="py-2.5 px-3 text-gray-500">{s.startTime} - {s.endTime}</td>
                      <td className="py-2.5 px-3">
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
                          {s.sessionStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full ${badgeClass}`}>
                          {s.attendanceStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-gray-400">
                        {s.markedAt ? new Date(s.markedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
