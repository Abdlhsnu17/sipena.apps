import { describe, expect, it } from 'vitest';
import { DISPLAY_TIME_ZONE, STORAGE_TIME_ZONE, getServerTimeSnapshot } from './time';

describe('getServerTimeSnapshot', () => {
  it('reports the fixed storage/display time zones and matching unix time', () => {
    const now = new Date('2026-07-18T09:30:00.000Z');
    const snapshot = getServerTimeSnapshot(now);

    expect(snapshot.storageTimeZone).toBe(STORAGE_TIME_ZONE);
    expect(snapshot.displayTimeZone).toBe(DISPLAY_TIME_ZONE);
    expect(snapshot.now).toBe(now.toISOString());
    expect(snapshot.unixMs).toBe(now.getTime());
  });
});
