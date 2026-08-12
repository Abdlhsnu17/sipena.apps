import { afterEach, describe, expect, it, vi } from 'vitest';
import { TtlCache } from './ttl-cache';

afterEach(() => {
  vi.useRealTimers();
});

describe('TtlCache', () => {
  it('returns a stored value while it is still fresh', () => {
    const cache = new TtlCache<number>(1000);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
  });

  it('drops the entry once the TTL has passed', () => {
    vi.useFakeTimers();
    const cache = new TtlCache<number>(1000);
    cache.set('a', 1);

    vi.advanceTimersByTime(1001);

    expect(cache.get('a')).toBeNull();
    expect(cache.size).toBe(0);
  });

  it('stores nothing at all when the TTL is zero (caching disabled)', () => {
    const cache = new TtlCache<number>(0);
    cache.set('a', 1);
    expect(cache.get('a')).toBeNull();
    expect(cache.size).toBe(0);
  });

  it('returns null for unknown keys and clears every entry on demand', () => {
    const cache = new TtlCache<number>(1000);
    cache.set('a', 1);
    cache.set('b', 2);

    expect(cache.get('missing')).toBeNull();
    cache.delete('a');
    expect(cache.get('a')).toBeNull();

    cache.clear();
    expect(cache.size).toBe(0);
  });
});
