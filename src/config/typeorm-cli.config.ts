import { DataSource } from 'typeorm';
import { UrlOrmEntity } from '../url/infrastructure/persistence/url.orm-entity';
import * as dotenv from 'dotenv';

dotenv.config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432'),
  username: process.env.DB_USER ?? 'shorten',
  password: process.env.DB_PASSWORD ?? 'shorten',
  database: process.env.DB_NAME ?? 'shorten_url',
  entities: [UrlOrmEntity],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});
