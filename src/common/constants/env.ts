export const ENV_KEY = {
  NODE_ENV: 'NODE_ENV',
  PORT: 'PORT',
  DB_HOST: 'DB_HOST',
  DB_PORT: 'DB_PORT',
  DB_USER: 'DB_USER',
  DB_PASSWORD: 'DB_PASSWORD',
  DB_NAME: 'DB_NAME',
  REDIS_HOST: 'REDIS_HOST',
  REDIS_PORT: 'REDIS_PORT',
  BASE_URL: 'BASE_URL',
  CACHE_TTL: 'CACHE_TTL',
  CACHE_BETA: 'CACHE_BETA',
} as const;

export type EnvKey = (typeof ENV_KEY)[keyof typeof ENV_KEY];
export type AppConfig = Record<EnvKey, string>;

export const IS_PRODUCTION = process.env[ENV_KEY.NODE_ENV] === 'production';
