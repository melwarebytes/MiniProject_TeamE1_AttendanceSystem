import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { api } from '../api';

const MESSAGES = {
  QR_EXPIRED: 'That code has expired. Scan the code currently on the screen.',
  DUPLICATE_CHECKIN: "You've already checked in for this class.",
  NOT_ENROLLED: "You're not enrolled in this class.",
  INVALID_TOKEN: "That isn't a valid SAMS check-in code.",
  SERVICE_UNAVAILABLE: 'Check-in is unavailable right now. Ask your teacher to mark you manually.',
};

export default function QrCheckIn() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const busyRef = useRef(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [manual, setManual] = useState('');
  const [showManual, setShowManual] = useState(false);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }

  useEffect(() => stopCamera, []);

  async function submit(token) {
    if (busyRef.current) return;
    busyRef.current = true;
    setError(null);
    try {
      const data = await api.checkIn(token.trim());
      setResult(data);
      stopCamera();
    } catch (err) {
      setError(MESSAGES[err.code] || err.message);
    } finally {
      setTimeout(() => {
        busyRef.current = false;
      }, 1500);
    }
  }

  async function startCamera() {
    setError(null);
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setScanning(true);
      requestAnimationFrame(tick);
    } catch (err) {
      setError('Could not open the camera. Allow camera access, or enter the code instead.');
      setShowManual(true);
    }
  }

  function tick() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!streamRef.current || !video || !canvas) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const code = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
      if (code?.data) submit(code.data);
    }
    requestAnimationFrame(tick);
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-800">Check In</h1>
        <p className="text-sm text-gray-600">Scan the QR code your teacher is showing in class.</p>
      </div>

      <div aria-live="polite">
        {result && (
          <div role="status" className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
            <div className="text-4xl" aria-hidden="true">✓</div>
            <div className="text-lg font-bold text-emerald-800 mt-2">You're checked in</div>
            <div className="text-sm text-emerald-900 mt-1">{result.course}</div>
            <div className="text-sm text-emerald-900">{result.time} · marked {result.status.toLowerCase()} at {new Date(result.checkedInAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        )}
        {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 text-sm">{error}</div>}
      </div>

      {!result && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className={`relative rounded-lg overflow-hidden bg-gray-900 aspect-square ${scanning ? '' : 'hidden'}`}>
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover" aria-label="Camera preview" />
            <div className="absolute inset-10 border-4 border-white/80 rounded-xl pointer-events-none" aria-hidden="true" />
          </div>
          <canvas ref={canvasRef} className="hidden" />
          {!scanning ? (
            <button onClick={startCamera} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              Scan QR code
            </button>
          ) : (
            <button onClick={stopCamera} className="w-full py-2 border border-gray-300 text-gray-800 rounded-lg hover:bg-gray-50">
              Stop camera
            </button>
          )}
          <button onClick={() => setShowManual((v) => !v)} className="text-sm text-indigo-700 hover:underline" aria-expanded={showManual}>
            {showManual ? 'Hide code entry' : "Can't scan? Enter the code instead"}
          </button>
          {showManual && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit(manual);
              }}
              className="space-y-2"
            >
              <label htmlFor="manual-code" className="block text-xs font-semibold text-gray-700">Check-in code</label>
              <textarea id="manual-code" rows={3} value={manual} onChange={(e) => setManual(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 text-xs font-mono" />
              <button type="submit" className="px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg">Check in</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
