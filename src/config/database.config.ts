import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { UrlOrmEntity } from '../url/infrastructure/persistence/url.orm-entity';
import { AppConfig, ENV_KEY, IS_PRODUCTION } from '../common/constants/env';
import { ConfigService } from '@nestjs/config';

export default registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'postgres',
    host: process.env[ENV_KEY.DB_HOST] ?? 'localhost',
    port: parseInt(process.env[ENV_KEY.DB_PORT] ?? '5432'),
    username: process.env[ENV_KEY.DB_USER] ?? 'shorten',
    password: process.env[ENV_KEY.DB_PASSWORD] ?? 'shorten',
    database: process.env[ENV_KEY.DB_NAME] ?? 'shorten_url',
    entities: [UrlOrmEntity],
    synchronize: !IS_PRODUCTION,
  }),
);

export const databaseFactory = (
  config: ConfigService<AppConfig>,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: config.get(ENV_KEY.DB_HOST) ?? 'localhost',
  port: parseInt(config.get(ENV_KEY.DB_PORT) ?? '5432'),
  username: config.get(ENV_KEY.DB_USER) ?? 'shorten',
  password: config.get(ENV_KEY.DB_PASSWORD) ?? 'shorten',
  database: config.get(ENV_KEY.DB_NAME) ?? 'shorten_url',
  entities: [UrlOrmEntity],
  synchronize: !IS_PRODUCTION,
});
