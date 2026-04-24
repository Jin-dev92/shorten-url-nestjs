export interface CachedUrl {
  originalUrl: string;
  expiresAt: string | null;
  storedAt: number;
  ttl: number;
}

export abstract class UrlCachePort {
  abstract get(shortKey: string): Promise<CachedUrl | null>;
  abstract set(shortKey: string, data: CachedUrl, ttlMs: number): Promise<void>;
  abstract del(shortKey: string): Promise<void>;
  abstract incrementView(shortKey: string): Promise<void>;
  abstract getAndResetViewCounts(): Promise<Map<string, number>>;
}
