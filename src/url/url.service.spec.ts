import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UrlService } from './application/url.service';
import { UrlRepository } from './domain/repository/url.repository';
import { UrlCachePort, CachedUrl } from './application/port/url-cache.port';
import { Url } from './domain/entity/url';
import { UrlNotFoundException } from './domain/exception/url-not-found.exception';
import { UrlExpiredException } from './domain/exception/url-expired.exception';

const MOCK_BASE_URL = 'http://localhost:3000';

function createMockUrl(overrides?: Partial<{ expiresAt: Date | null }>): Url {
  return new Url(
    '1',
    'https://google.com',
    '1',
    overrides?.expiresAt ?? null,
    0,
    new Date(),
  );
}

function createMockCachedUrl(overrides?: Partial<CachedUrl>): CachedUrl {
  return {
    originalUrl: 'https://google.com',
    expiresAt: null,
    storedAt: Date.now(),
    ttl: 3600,
    ...overrides,
  };
}

const mockRepo = () =>
  ({
    findByShortKey: jest.fn(),
    saveWithKey: jest.fn(),
    incrementViewCount: jest.fn(),
    deleteExpired: jest.fn(),
  }) satisfies Partial<jest.Mocked<UrlRepository>>;

const mockCache = () =>
  ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    incrementView: jest.fn(),
    getAndResetViewCounts: jest.fn(),
  }) satisfies Partial<jest.Mocked<UrlCachePort>>;

describe('UrlService', () => {
  let service: UrlService;
  let repo: ReturnType<typeof mockRepo>;
  let cache: ReturnType<typeof mockCache>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UrlService,
        { provide: UrlRepository, useFactory: mockRepo },
        { provide: UrlCachePort, useFactory: mockCache },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              ({ BASE_URL: MOCK_BASE_URL, CACHE_TTL: '3600', CACHE_BETA: '1' })[
                key
              ],
          },
        },
      ],
    }).compile();

    service = module.get(UrlService);
    repo = module.get(UrlRepository);
    cache = module.get(UrlCachePort);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create()', () => {
    describe('정상 케이스', () => {
      it('saveWithKey를 호출하고 단축 URL을 반환한다', async () => {
        // Arrange
        repo.saveWithKey.mockResolvedValue(undefined);

        // Act
        const result = await service.create({
          originalUrl: 'https://google.com',
        });

        // Assert
        expect(result.shortUrl).toMatch(
          new RegExp(`^${MOCK_BASE_URL}/.+`),
        );
        expect(repo.saveWithKey).toHaveBeenCalledWith(
          expect.objectContaining({
            originalUrl: 'https://google.com',
            expiresAt: null,
          }),
        );
      });

      it('unique 충돌 시 재시도하여 성공한다', async () => {
        // Arrange
        const uniqueError = Object.assign(new Error('unique violation'), {
          code: '23505',
        });
        repo.saveWithKey
          .mockRejectedValueOnce(uniqueError)
          .mockResolvedValue(undefined);

        // Act
        const result = await service.create({
          originalUrl: 'https://google.com',
        });

        // Assert
        expect(result.shortUrl).toMatch(new RegExp(`^${MOCK_BASE_URL}/.+`));
        expect(repo.saveWithKey).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('getOriginalUrl()', () => {
    describe('캐시 히트', () => {
      it('DB를 조회하지 않고 원본 URL을 반환한다', async () => {
        // Arrange
        cache.get.mockResolvedValue(createMockCachedUrl());
        cache.incrementView.mockResolvedValue(undefined);

        // Act
        const result = await service.getOriginalUrl('1');

        // Assert
        expect(result).toBe('https://google.com');
        expect(repo.findByShortKey).not.toHaveBeenCalled();
      });
    });

    describe('캐시 미스', () => {
      it('DB를 조회하고 캐시에 저장한 뒤 원본 URL을 반환한다', async () => {
        // Arrange
        cache.get.mockResolvedValue(null);
        cache.set.mockResolvedValue(undefined);
        cache.incrementView.mockResolvedValue(undefined);
        repo.findByShortKey.mockResolvedValue(createMockUrl());

        // Act
        const result = await service.getOriginalUrl('1');

        // Assert
        expect(result).toBe('https://google.com');
        expect(cache.set).toHaveBeenCalled();
      });

      it('존재하지 않는 키면 UrlNotFoundException을 던진다', async () => {
        // Arrange
        expect.assertions(1);
        cache.get.mockResolvedValue(null);
        repo.findByShortKey.mockResolvedValue(null);

        // Act & Assert
        await expect(service.getOriginalUrl('notexist')).rejects.toThrow(
          UrlNotFoundException,
        );
      });

      it('만료된 URL이면 UrlExpiredException을 던진다', async () => {
        // Arrange
        expect.assertions(1);
        cache.get.mockResolvedValue(null);
        repo.findByShortKey.mockResolvedValue(
          createMockUrl({ expiresAt: new Date('2000-01-01') }),
        );

        // Act & Assert
        await expect(service.getOriginalUrl('1')).rejects.toThrow(
          UrlExpiredException,
        );
      });
    });
  });
});
