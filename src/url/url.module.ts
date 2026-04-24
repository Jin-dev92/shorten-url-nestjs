import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UrlOrmEntity } from './infrastructure/persistence/url.orm-entity';
import { UrlTypeormRepository } from './infrastructure/persistence/url.typeorm.repository';
import { UrlRedisCache } from './infrastructure/cache/url.redis-cache';
import { UrlRepository } from './domain/repository/url.repository';
import { UrlCachePort } from './application/port/url-cache.port';
import { UrlService } from './application/url.service';
import { UrlController } from './presentation/url.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UrlOrmEntity])],
  controllers: [UrlController],
  providers: [
    UrlService,
    { provide: UrlRepository, useClass: UrlTypeormRepository },
    { provide: UrlCachePort, useClass: UrlRedisCache },
  ],
})
export class UrlModule {}
