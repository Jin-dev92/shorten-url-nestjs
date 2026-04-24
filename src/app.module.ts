import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { createKeyv } from '@keyv/redis';
import { CacheableMemory } from 'cacheable';
import { Keyv } from 'keyv';
import { UrlModule } from './url/url.module';
import databaseConfig, { databaseFactory } from './config/database.config';
import { AppConfig, ENV_KEY } from './common/constants/env';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig>) => databaseFactory(config),
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig>) => ({
        stores: [
          new Keyv({
            store: new CacheableMemory({ ttl: 30000, lruSize: 5000 }),
          }),
          createKeyv(
            `redis://${config.get(ENV_KEY.REDIS_HOST) ?? 'localhost'}:${config.get(ENV_KEY.REDIS_PORT) ?? 6379}`,
          ),
        ],
      }),
    }),
    ScheduleModule.forRoot(),
    UrlModule,
  ],
})
export class AppModule {}
