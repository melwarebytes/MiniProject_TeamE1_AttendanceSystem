// Regression: QR "today" must follow the IST calendar, not the UTC server clock.
const { istToday } = require('../services/qrService');

describe('[FR-07] QR day check uses IST', () => {
  afterEach(() => jest.useRealTimers());

  test('00:30 IST on 12 Nov is still 11 Nov in UTC but today is 12 Nov', () => {
    jest.useFakeTimers({ now: new Date('2026-11-11T19:00:00Z') });
    expect(istToday()).toBe('2026-11-12');
  });

  test('afternoon IST matches the UTC date', () => {
    jest.useFakeTimers({ now: new Date('2026-11-12T09:00:00Z') });
    expect(istToday()).toBe('2026-11-12');
  });
});
