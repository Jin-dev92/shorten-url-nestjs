import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

jest.setTimeout(30000);

describe('URL Shortener (e2e)', () => {
  let app: INestApplication;
  let shortKey: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /shorten — 단축 URL 생성', async () => {
    const res = await request(app.getHttpServer())
      .post('/shorten')
      .send({ originalUrl: 'https://www.example.com' })
      .expect(201);

    expect(res.body.shortUrl).toMatch(/^http:\/\/localhost:3000\/.+/);
    shortKey = res.body.shortUrl.split('/').pop();
  });

  it('GET /:shortKey — 302 리다이렉트', async () => {
    const res = await request(app.getHttpServer())
      .get(`/${shortKey}`)
      .expect(302);

    expect(res.headers.location).toBe('https://www.example.com');
  });

  it('GET /:shortKey — 두 번째 조회도 302 (캐시 히트)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/${shortKey}`)
      .expect(302);

    expect(res.headers.location).toBe('https://www.example.com');
  });

  it('GET /notexist — 404 반환', async () => {
    await request(app.getHttpServer()).get('/notexist').expect(404);
  });

  it('POST /shorten with expiresAt — 만료 URL 410 반환', async () => {
    const res = await request(app.getHttpServer())
      .post('/shorten')
      .send({
        originalUrl: 'https://expired.example.com',
        expiresAt: new Date('2000-01-01').toISOString(),
      })
      .expect(201);

    const expiredKey = res.body.shortUrl.split('/').pop();
    await request(app.getHttpServer()).get(`/${expiredKey}`).expect(410);
  });
});
