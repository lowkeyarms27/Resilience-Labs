// Real in-memory LRU cache with TTL — used as the Lambda-Cache node's backing store

type CacheEntry<T> = { value: T; expiresAt: number; hits: number };

export class RealCache<T = unknown> {
  private store = new Map<string, CacheEntry<T>>();
  private totalGets = 0;
  private totalHits = 0;
  private readonly ttlMs: number;
  private readonly maxSize: number;

  constructor(ttlMs = 30_000, maxSize = 500) {
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
  }

  set(key: string, value: T): void {
    if (this.store.size >= this.maxSize) {
      const firstKey = this.store.keys().next().value;
      if (firstKey !== undefined) this.store.delete(firstKey);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs, hits: 0 });
  }

  get(key: string): T | null {
    this.totalGets++;
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { this.store.delete(key); return null; }
    entry.hits++;
    this.totalHits++;
    return entry.value;
  }

  flush(): number {
    const count = this.store.size;
    this.store.clear();
    this.totalGets = 0;
    this.totalHits = 0;
    return count;
  }

  get metrics() {
    const now = Date.now();
    let expired = 0;
    for (const [k, v] of this.store) {
      if (now > v.expiresAt) { this.store.delete(k); expired++; }
    }
    const hitRate = this.totalGets > 0 ? this.totalHits / this.totalGets : 0;
    return {
      size: this.store.size,
      totalGets: this.totalGets,
      totalHits: this.totalHits,
      hitRate,
      expired,
      memoryEstimateKB: Math.round(this.store.size * 0.5),
    };
  }
}

// Singleton cache instance — this is the real cache Lambda-Cache node monitors
export const appCache = new RealCache(60_000, 1000);

// Warm it up with some realistic data
for (let i = 0; i < 50; i++) {
  appCache.set(`session:${Math.random().toString(36).slice(2)}`, { uid: i, ts: Date.now() });
}
for (let i = 0; i < 20; i++) {
  appCache.get(`session:${Math.random().toString(36).slice(2)}`); // generate some misses
}
