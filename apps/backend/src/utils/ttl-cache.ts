/**
 * Cache in-process sederhana dengan masa berlaku (TTL).
 *
 * Dipakai untuk menahan hasil query berat yang jarang berubah dalam hitungan
 * detik (mis. dataset SPK), tanpa menambah dependensi eksternal. Redis di
 * aplikasi ini bersifat opsional/best-effort, sehingga cache tingkat proses
 * lebih dapat diandalkan untuk kebutuhan ini.
 */
export class TtlCache<T> {
  private readonly store = new Map<string, { value: T; expiresAt: number }>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | null {
    if (this.ttlMs <= 0) return null;
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.ttlMs <= 0) return;
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

export default TtlCache;
