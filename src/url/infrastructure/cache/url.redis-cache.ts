import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CachedUrl, UrlCachePort } from '../../application/port/url-cache.port';

@Injectable()
export class UrlRedisCache extends UrlCachePort {
  private readonly CACHE_PREFIX = 'url:';
  private readonly VIEW_PREFIX = 'view:';

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {
    super();
  }

  async get(shortKey: string): Promise<CachedUrl | null> {
    return (
      (await this.cacheManager.get<CachedUrl>(
        `${this.CACHE_PREFIX}${shortKey}`,
      )) ?? null
    );
  }

  async set(shortKey: string, data: CachedUrl, ttlMs: number): Promise<void> {
    await this.cacheManager.set(`${this.CACHE_PREFIX}${shortKey}`, data, ttlMs);
  }

  async del(shortKey: string): Promise<void> {
    await this.cacheManager.del(`${this.CACHE_PREFIX}${shortKey}`);
  }

  async incrementView(shortKey: string): Promise<void> {
    const key = `${this.VIEW_PREFIX}${shortKey}`;
    const current = (await this.cacheManager.get<number>(key)) ?? 0;
    await this.cacheManager.set(key, current + 1, 0);
  }

  async getAndResetViewCounts(): Promise<Map<string, number>> {
    const store = (this.cacheManager as any).store;
    const result = new Map<string, number>();
    if (!store?.keys) return result;

    const keys: string[] = await store.keys(`${this.VIEW_PREFIX}*`);
    await Promise.all(
      keys.map(async (key) => {
        const count = await this.cacheManager.get<number>(key);
        if (!count) return;
        result.set(key.replace(this.VIEW_PREFIX, ''), count);
        await this.cacheManager.del(key);
      }),
    );
    return result;
  }
}
