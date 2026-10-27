import React, { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../api';

const REFRESH_MS = 25000; // tokens live 30 s on the server

function useCountdown(until) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!until) return null;
  const left = Math.max(0, Math.round((new Date(until).getTime() - now) / 1000));
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}

export default function QrSession() {
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [minutes, setMinutes] = useState(5);
  const [qrImage, setQrImage] = useState(null);
  const [windowEnds, setWindowEnds] = useState(null);
  const [counts, setCounts] = useState({ checkedIn: 0, enrolled: 0 });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const stageRef = useRef(null);
  const countdown = useCountdown(windowEnds);

  const loadToday = useCallback(async () => {
    try {
      const data = await api.qrToday();
      setSessions(data.sessions);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  const refreshToken = useCallback(async (sessionId) => {
    try {
      const data = await api.qrToken(sessionId);
      setQrImage(await QRCode.toDataURL(data.token, { width: 520, margin: 1, errorCorrectionLevel: 'M' }));
      setWindowEnds(data.windowExpiresAt);
    } catch (err) {
      if (err.status === 410) {
        setQrImage(null);
        setWindowEnds(null);
        loadToday();
      } else setError(err.message);
    }
  }, [loadToday]);

  // While a window is open: rotate the code and poll the check-in count
  useEffect(() => {
    if (!selected || !windowEnds) return undefined;
    const rotate = setInterval(() => refreshToken(selected.id), REFRESH_MS);
    const poll = setInterval(async () => {
      try {
        const s = await api.qrStatus(selected.id);
        setCounts({ checkedIn: s.checkedIn, enrolled: s.enrolled });
        if (!s.open) {
          setQrImage(null);
          setWindowEnds(null);
        }
      } catch (e) {
        /* keep showing the code; the next poll retries */
      }
    }, 4000);
    return () => {
      clearInterval(rotate);
      clearInterval(poll);
    };
  }, [selected, windowEnds, refreshToken]);

  async function choose(session) {
    setError(null);
    setSelected(session);
    setQrImage(null);
    setWindowEnds(null);
    const s = await api.qrStatus(session.id).catch(() => null);
    if (s) setCounts({ checkedIn: s.checkedIn, enrolled: s.enrolled });
    if (s?.open) refreshToken(session.id);
  }

  async function start() {
    setError(null);
    try {
      await api.openQrWindow(selected.id, Number(minutes));
      await refreshToken(selected.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function stop() {
    await api.closeQrWindow(selected.id).catch(() => {});
    setQrImage(null);
    setWindowEnds(null);
    loadToday();
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-800">QR Check-in</h1>
        <p className="text-sm text-gray-600">
          Show a rotating QR code in class. Students scan it with the SAMS app and are marked present. The code changes every 25 seconds, so a photo of it stops working almost at once.
        </p>
      </div>

      {error && <div role="alert" className="p-4 bg-red-50 text-red-800 rounded-lg text-sm border border-red-200">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section aria-labelledby="today-heading" className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 h-fit">
          <h2 id="today-heading" className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">Today's classes</h2>
          {loading && <p className="text-sm text-gray-600">Loading…</p>}
          {!loading && sessions.length === 0 && <p className="text-sm text-gray-600">You have no classes today.</p>}
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => choose(s)}
                  aria-pressed={selected?.id === s.id}
                  className={`w-full text-left rounded-lg border px-3 py-2 transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    selected?.id === s.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-semibold text-gray-900 text-sm">{s.course}</div>
                  <div className="text-xs text-gray-600">{s.courseName}</div>
                  <div className="text-xs text-gray-700 mt-1 flex justify-between">
                    <span>{s.startTime}–{s.endTime} · {s.enrolled} students</span>
                    {s.windowOpen && <span className="text-emerald-700 font-semibold">● Live</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-live="polite" className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6 min-h-[28rem] flex flex-col items-center justify-center">
          {!selected && <p className="text-gray-600 text-sm">Pick one of today's classes to start check-in.</p>}

          {selected && !qrImage && (
            <div className="text-center space-y-4">
              <div>
                <div className="text-lg font-bold text-gray-900">{selected.course} · {selected.startTime}–{selected.endTime}</div>
                <div className="text-sm text-gray-600">{counts.checkedIn} of {counts.enrolled} checked in by QR so far</div>
              </div>
              <div className="flex items-end justify-center gap-3">
                <div className="text-left">
                  <label htmlFor="qr-minutes" className="block text-xs font-semibold text-gray-700 mb-1">Window length</label>
                  <select id="qr-minutes" value={minutes} onChange={(e) => setMinutes(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((m) => (
                      <option key={m} value={m}>{m} minute{m > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>
                <button onClick={start} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                  Start check-in
                </button>
              </div>
            </div>
          )}

          {selected && qrImage && (
            <div ref={stageRef} className="w-full flex flex-col items-center bg-white">
              <div className="flex w-full justify-between items-start mb-4">
                <div>
                  <div className="text-xl font-bold text-gray-900">{selected.course} · {selected.courseName}</div>
                  <div className="text-sm text-gray-600">Open SAMS → Check In and scan this code</div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-black text-indigo-700 tabular-nums">{counts.checkedIn}<span className="text-lg text-gray-500">/{counts.enrolled}</span></div>
                  <div className="text-xs text-gray-600">checked in</div>
                </div>
              </div>
              <img src={qrImage} alt={`Check-in QR code for ${selected.course}. It changes every 25 seconds.`} className="w-full max-w-[min(26rem,60vh)] aspect-square" />
              <div className="mt-4 flex items-center gap-4">
                <span className="text-sm text-gray-700">Window closes in <strong className="tabular-nums">{countdown}</strong></span>
                <button onClick={() => stageRef.current?.requestFullscreen?.()} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Full screen</button>
                <button onClick={stop} className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg">Close now</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
