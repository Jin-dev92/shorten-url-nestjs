import { Url } from '../entity/url';

export abstract class UrlRepository {
  abstract findByShortKey(shortKey: string): Promise<Url | null>;
  abstract saveWithKey(data: {
    originalUrl: string;
    expiresAt: Date | null;
    shortKey: string;
  }): Promise<void>;
  abstract incrementViewCount(shortKey: string, count: number): Promise<void>;
  abstract deleteExpired(): Promise<void>;
}
