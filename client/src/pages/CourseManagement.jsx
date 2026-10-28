import React, { useEffect, useState } from 'react';
import { Field, Notice, Panel, inputClass, buttonClass, send, allPages } from '../components/AdminUI';
export default function CourseManagement() {
  const [courses, setCourses] = useState([]),
    [sections, setSections] = useState([]),
    [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(''),
    [faculty, setFaculty] = useState([]),
    [students, setStudents] = useState([]);
  const [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  async function load() {
    const [c, s, u] = await Promise.all([allPages('/courses'), allPages('/sections'), allPages('/users')]);
    setCourses(c);
    setSections(s);
    setUsers(u.filter((u) => u.active));
    return s;
  }
  function choose(id, data = sections) {
    setSelected(id);
    const s = data.find((s) => s.id === id);
    setFaculty(s?.faculty.map((f) => f.userId) || []);
    setStudents(
      s?.enrollments
        .filter((e) => !e.periods.length || e.periods.some((p) => !p.endsAt))
        .map((e) => e.userId) || [],
    );
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  async function run(fn) {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      await fn();
      const s = await load();
      if (selected) choose(selected, s);
      setMessage('Changes saved.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const submit = (path, e) => {
    e.preventDefault();
    const form = e.currentTarget;
    run(async () => {
      await send(path, 'POST', Object.fromEntries(new FormData(form)));
      form.reset();
    });
  };
  return (
    <div className="max-w-7xl mx-auto px-4 space-y-6">
      <h1 className="text-2xl font-bold">Courses and enrolments</h1>
      <Notice error={error} message={message} />
      <Panel title="Create course">
        <form onSubmit={(e) => submit('/courses', e)} className="grid sm:grid-cols-3 gap-4">
          <Field label="Course code">
            <input className={inputClass} name="code" required />
          </Field>
          <Field label="Course name">
            <input className={inputClass} name="name" required />
          </Field>
          <div className="self-end">
            <button className={buttonClass} disabled={busy}>
              Create course
            </button>
          </div>
        </form>
      </Panel>
      <Panel title="Create section">
        <form onSubmit={(e) => submit('/sections', e)} className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Field label="Course">
            <select name="courseId" className={inputClass} required>
              <option value="">Select course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Section name">
            <input className={inputClass} name="name" required />
          </Field>
          {['semesterStart', 'semesterEnd'].map((name, i) => (
            <Field key={name} label={i ? 'Semester end' : 'Semester start'}>
              <input type="date" className={inputClass} name={name} required />
            </Field>
          ))}
          <div className="self-end">
            <button className={buttonClass} disabled={busy}>
              Create section
            </button>
          </div>
        </form>
      </Panel>
      <Panel title="Manage section">
        <Field label="Section">
          <select className={inputClass} value={selected} onChange={(e) => choose(e.target.value)}>
            <option value="">Select section</option>
            {sections.map((s) => (
              <option value={s.id} key={s.id}>
                {s.course.code} / {s.name} · {s.semesterStart.slice(0, 10)}
              </option>
            ))}
          </select>
        </Field>
        {selected && (
          <>
            <p className="text-sm text-gray-700">
              Roster changes apply to classes starting after the change. Previous attendance stays intact. A
              student can belong to only one section of a course in an overlapping semester.
            </p>
            <div className="grid sm:grid-cols-2 gap-6">
              {[
                ['FACULTY', faculty, setFaculty, 'faculty', 'Assigned faculty'],
                ['STUDENT', students, setStudents, 'enrolments', 'Enrolled students'],
              ].map(([role, chosen, setChosen, path, label]) => (
                <form
                  key={role}
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(() => send(`/sections/${selected}/${path}`, 'PUT', { userIds: chosen }));
                  }}
                  className="space-y-3"
                >
                  <fieldset className="border rounded-lg p-3">
                    <legend className="font-semibold px-1">{label}</legend>
                    <div className="max-h-72 overflow-y-auto space-y-2">
                      {users
                        .filter((u) => u.role === role)
                        .map((u) => (
                          <label key={u.id} className="flex gap-2 items-center text-sm">
                            <input
                              type="checkbox"
                              checked={chosen.includes(u.id)}
                              onChange={(e) =>
                                setChosen(
                                  e.target.checked ? [...chosen, u.id] : chosen.filter((id) => id !== u.id),
                                )
                              }
                            />
                            {u.name} ({u.srn || u.email})
                          </label>
                        ))}
                    </div>
                  </fieldset>
                  <button className={buttonClass} disabled={busy}>
                    Save {label.toLowerCase()}
                  </button>
                </form>
              ))}
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
