import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Field, Notice, Panel, inputClass, buttonClass, send } from '../components/AdminUI';
export default function PolicySettings() {
  const [policy, setPolicy] = useState(null),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api
      .request('/policies')
      .then(setPolicy)
      .catch((e) => setError(e.message));
  }, []);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { attendanceThreshold, editWindowHours, qrWindowMinutes, holidays } = policy;
      setPolicy(
        await send('/policies', 'PUT', { attendanceThreshold, editWindowHours, qrWindowMinutes, holidays }),
      );
      setMessage('Policy saved and applied to all sections.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="max-w-4xl mx-auto px-4 space-y-6">
      <h1 className="text-2xl font-bold">Attendance policy</h1>
      <Notice error={error} message={message} />
      {policy && (
        <form onSubmit={save} className="space-y-6">
          <Panel title="Institution settings">
            <p className="text-sm text-gray-700">
              Applies to existing and new sections. Holidays are skipped when generating timetables.
            </p>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                ['attendanceThreshold', 'Threshold (%)', 50, 100, 0.1],
                ['editWindowHours', 'Edit window (hours)', 0, 168, 1],
                ['qrWindowMinutes', 'QR window (minutes)', 1, 10, 1],
              ].map(([key, label, min, max, step]) => (
                <Field key={key} label={label}>
                  <input
                    type="number"
                    className={inputClass}
                    min={min}
                    max={max}
                    step={step}
                    required
                    value={policy[key]}
                    onChange={(e) =>
                      setPolicy({ ...policy, [key]: e.target.value === '' ? '' : Number(e.target.value) })
                    }
                  />
                </Field>
              ))}
            </div>
          </Panel>
          <Panel title="Institution holidays">
            {policy.holidays.map((h, i) => (
              <div key={i} className="flex flex-wrap items-end gap-3">
                <Field label={`Holiday ${i + 1} date`}>
                  <input
                    type="date"
                    required
                    className={inputClass}
                    value={h.date}
                    onChange={(e) =>
                      setPolicy({
                        ...policy,
                        holidays: policy.holidays.map((v, j) =>
                          j === i ? { ...v, date: e.target.value } : v,
                        ),
                      })
                    }
                  />
                </Field>
                <Field label={`Holiday ${i + 1} reason`}>
                  <input
                    className={inputClass}
                    value={h.reason}
                    onChange={(e) =>
                      setPolicy({
                        ...policy,
                        holidays: policy.holidays.map((v, j) =>
                          j === i ? { ...v, reason: e.target.value } : v,
                        ),
                      })
                    }
                  />
                </Field>
                <button
                  type="button"
                  className="p-2 text-red-800 underline"
                  aria-label={`Remove holiday ${i + 1}`}
                  onClick={() =>
                    setPolicy({ ...policy, holidays: policy.holidays.filter((_, j) => j !== i) })
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-indigo-800 underline"
              onClick={() =>
                setPolicy({ ...policy, holidays: [...policy.holidays, { date: '', reason: '' }] })
              }
            >
              Add holiday
            </button>
          </Panel>
          <button className={buttonClass} disabled={busy}>
            {busy ? 'Saving…' : 'Save policy'}
          </button>
        </form>
      )}
    </div>
  );
}
