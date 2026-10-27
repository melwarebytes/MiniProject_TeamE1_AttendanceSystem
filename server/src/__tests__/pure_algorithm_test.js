// Pure algorithmic logic check for SAMS formulas
function calculateMetrics({ attended, held, threshold = 75.0 }) {
  const percentage = held > 0 ? Number(((attended / held) * 100).toFixed(1)) : 100.0;
  const thresholdFraction = threshold / 100.0;
  let canStillMiss = 0;
  if (thresholdFraction > 0) {
    const rawMiss = Math.floor(attended / thresholdFraction - held);
    canStillMiss = Math.max(0, rawMiss);
  }

  let classesToRecover = 0;
  if (percentage < threshold && thresholdFraction < 1.0) {
    const needed = Math.ceil((thresholdFraction * held - attended) / (1 - thresholdFraction));
    classesToRecover = Math.max(0, needed);
  }

  return {
    percentage,
    canStillMiss,
    classesToRecover,
    isLowAttendance: percentage < threshold,
  };
}

function isWithinEditWindow(sessionDate, endTime, editWindowHours = 48) {
  const [endHour, endMin] = endTime.split(':').map(Number);
  const sessionEnd = new Date(sessionDate);
  sessionEnd.setHours(endHour, endMin, 0, 0);
  const now = new Date();
  const diffMs = now - sessionEnd;
  const maxDiffMs = editWindowHours * 60 * 60 * 1000;
  return diffMs <= maxDiffMs;
}

// Assertions
const r1 = calculateMetrics({ attended: 15, held: 20, threshold: 75.0 });
console.assert(r1.percentage === 75.0, '75% attendance');
console.assert(r1.canStillMiss === 0, 'canStillMiss should be 0 at exactly threshold');

const r2 = calculateMetrics({ attended: 15, held: 16, threshold: 75.0 });
console.assert(r2.canStillMiss === 4, 'canStillMiss should be 4');

const r3 = calculateMetrics({ attended: 10, held: 16, threshold: 75.0 });
console.assert(r3.canStillMiss === 0, 'canStillMiss should be 0 when below threshold');
console.assert(r3.isLowAttendance === true, 'should be marked low attendance');
console.assert(r3.classesToRecover === 8, 'should require 8 consecutive classes to recover to 75%');

console.log('✅ All algorithm and mathematical formula assertions passed successfully!');
