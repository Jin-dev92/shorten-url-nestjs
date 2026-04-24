import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { UrlRepository } from '../domain/repository/url.repository';
import { UrlCachePort } from './port/url-cache.port';
import { UrlNotFoundException } from '../domain/exception/url-not-found.exception';
import { UrlExpiredException } from '../domain/exception/url-expired.exception';
import { encode } from '../../shared/utils/base62';
import { AppConfig, ENV_KEY } from '../../common/constants/env';

@Injectable()
export class UrlService {
  private readonly baseUrl: string;
  private readonly cacheTtl: number;
  private readonly cacheBeta: number;

  constructor(
    private readonly urlRepository: UrlRepository,
    private readonly urlCache: UrlCachePort,
    private readonly configService: ConfigService<AppConfig>,
  ) {
    this.baseUrl =
      this.configService.get(ENV_KEY.BASE_URL) ?? 'http://localhost:3000';
    this.cacheTtl = parseInt(
      this.configService.get(ENV_KEY.CACHE_TTL) ?? '3600',
    );
    this.cacheBeta = parseFloat(
      this.configService.get(ENV_KEY.CACHE_BETA) ?? '1',
    );
  }

  private generateShortKey(): string {
    // 6바이트 = 48비트 → 최대 281조 경우의 수. 충돌 확률이 사실상 0에 수렴
    return encode(BigInt('0x' + randomBytes(6).toString('hex')));
  }

  async create(dto: {
    originalUrl: string;
    expiresAt?: Date;
  }): Promise<{ shortUrl: string }> {
    for (let i = 0; i < 5; i++) {
      try {
        const shortKey = this.generateShortKey();
        await this.urlRepository.saveWithKey({
          originalUrl: dto.originalUrl,
          expiresAt: dto.expiresAt ?? null,
          shortKey,
        });
        return { shortUrl: `${this.baseUrl}/${shortKey}` };
      } catch (e: any) {
        // 23505: PostgreSQL unique_violation. 키 충돌이면 재시도, 그 외는 즉시 rethrow
        if (e.code !== '23505') throw e;
      }
    }
    throw new Error('단축 URL 키 생성에 실패했습니다');
  }

  async getOriginalUrl(shortKey: string): Promise<string> {
    const cached = await this.getWithPER(shortKey);
    if (cached) {
      if (cached.expiresAt && new Date(cached.expiresAt) < new Date()) {
        throw new UrlExpiredException(shortKey);
      }
      await this.urlCache.incrementView(shortKey);
      return cached.originalUrl;
    }

    const url = await this.urlRepository.findByShortKey(shortKey);
    if (!url) throw new UrlNotFoundException(shortKey);
    if (url.isExpired()) throw new UrlExpiredException(shortKey);

    const ttl = url.expiresAt
      ? Math.floor((url.expiresAt.getTime() - Date.now()) / 1000)
      : this.cacheTtl;

    await this.urlCache.set(
      shortKey,
      {
        originalUrl: url.originalUrl,
        expiresAt: url.expiresAt?.toISOString() ?? null,
        storedAt: Date.now(),
        ttl,
      },
      ttl * 1000,
    );

    await this.urlCache.incrementView(shortKey);
    return url.originalUrl;
  }

  private async getWithPER(shortKey: string) {
    const entry = await this.urlCache.get(shortKey);
    if (!entry) return null;

    const elapsed = (Date.now() - entry.storedAt) / 1000;
    const remainingTtl = entry.ttl - elapsed;

    // PER 공식: remainingTtl > -beta * ln(rand). TTL이 짧을수록 조기 갱신 확률이 높아짐
    if (remainingTtl > -this.cacheBeta * Math.log(Math.random())) {
      return entry;
    }

    await this.urlCache.del(shortKey);
    return null;
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async syncViewCounts(): Promise<void> {
    const counts = await this.urlCache.getAndResetViewCounts();
    await Promise.all(
      Array.from(counts.entries()).map(([shortKey, count]) =>
        this.urlRepository.incrementViewCount(shortKey, count),
      ),
    );
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanExpiredUrls(): Promise<void> {
    await this.urlRepository.deleteExpired();
  }
}
