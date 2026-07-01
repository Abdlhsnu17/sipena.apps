export const STORAGE_TIME_ZONE = 'UTC';
export const DISPLAY_TIME_ZONE = 'Asia/Jakarta';

export interface ServerTimeSnapshot {
  now: string;
  unixMs: number;
  storageTimeZone: typeof STORAGE_TIME_ZONE;
  displayTimeZone: typeof DISPLAY_TIME_ZONE;
}

export const getServerNow = (): Date => new Date();

export const getServerTimeSnapshot = (now: Date = getServerNow()): ServerTimeSnapshot => ({
  now: now.toISOString(),
  unixMs: now.getTime(),
  storageTimeZone: STORAGE_TIME_ZONE,
  displayTimeZone: DISPLAY_TIME_ZONE,
});
