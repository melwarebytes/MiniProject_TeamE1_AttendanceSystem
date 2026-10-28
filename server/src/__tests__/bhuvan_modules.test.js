const { calculateMetrics } = require('../services/dashboardService');
const { isWithinEditWindow } = require('../services/correctionService');

describe('SAMS Bhuvan Modules — Core Logic & Unit Tests', () => {
  describe('[FR-09 & TC-09] Student Dashboard Attendance Calculations', () => {
    test('calculates correct percentage with one decimal place', () => {
      // 15 attended out of 20 held = 75.0%
      const res1 = calculateMetrics({ attended: 15, held: 20, threshold: 75.0 });
      expect(res1.percentage).toBe(75.0);
      expect(res1.isLowAttendance).toBe(false);

      // 14 attended out of 20 held = 70.0%
      const res2 = calculateMetrics({ attended: 14, held: 20, threshold: 75.0 });
      expect(res2.percentage).toBe(70.0);
      expect(res2.isLowAttendance).toBe(true);

      // 7 attended out of 9 held = 77.8% (77.777... rounded to 1 decimal place)
      const res3 = calculateMetrics({ attended: 7, held: 9, threshold: 75.0 });
      expect(res3.percentage).toBe(77.8);
      expect(res3.isLowAttendance).toBe(false);
    });

    test('calculates "can-still-miss" correctly according to formula: floor(attended / threshold - held)', () => {
      // Threshold 75% (0.75). Attended 15, held 16.
      // 15 / 0.75 = 20. 20 - 16 = 4.
      const res = calculateMetrics({ attended: 15, held: 16, threshold: 75.0 });
      expect(res.canStillMiss).toBe(4);

      // If student misses 4 classes: attended = 15, held = 20 -> 15/20 = 75.0% (exact threshold)
      const afterMissing4 = calculateMetrics({ attended: 15, held: 20, threshold: 75.0 });
      expect(afterMissing4.percentage).toBe(75.0);
      expect(afterMissing4.canStillMiss).toBe(0);
    });

    test('"can-still-miss" returns 0 if student is already below threshold', () => {
      // Attended 10 out of 16 (62.5% < 75%)
      const res = calculateMetrics({ attended: 10, held: 16, threshold: 75.0 });
      expect(res.canStillMiss).toBe(0);
      expect(res.isLowAttendance).toBe(true);
      expect(res.classesToRecover).toBeGreaterThan(0);
    });

    test('handles 0 sessions held gracefully', () => {
      const res = calculateMetrics({ attended: 0, held: 0, threshold: 75.0 });
      expect(res.percentage).toBe(100.0);
      expect(res.canStillMiss).toBe(0);
      expect(res.isLowAttendance).toBe(false);
    });
  });

  describe('[FR-08] Edit Window Calculation for Direct Corrections', () => {
    beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2026-10-28T12:00:00Z')); });
    afterEach(() => jest.useRealTimers());
    test('allows direct edit if within window (e.g. 24 hours elapsed for 48h window)', () => {
      const sessionDate = new Date();
      sessionDate.setHours(sessionDate.getHours() - 24);
      const isAllowed = isWithinEditWindow(sessionDate, '10:00', 48);
      expect(isAllowed).toBe(true);
    });

    test('rejects direct edit if outside window (e.g. 50 hours elapsed for 48h window)', () => {
      const sessionDate = new Date();
      sessionDate.setHours(sessionDate.getHours() - 50);
      const isAllowed = isWithinEditWindow(sessionDate, '10:00', 48);
      expect(isAllowed).toBe(false);
    });
  });
});
