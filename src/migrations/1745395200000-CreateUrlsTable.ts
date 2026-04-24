import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUrlsTable1745395200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "urls" (
        "id"           BIGSERIAL PRIMARY KEY,
        "original_url" TEXT NOT NULL,
        "short_key"    VARCHAR(12) NOT NULL,
        "expires_at"   TIMESTAMPTZ NULL,
        "view_count"   BIGINT NOT NULL DEFAULT 0,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_urls_short_key"
        ON "urls" ("short_key")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_urls_expires_at"
        ON "urls" ("expires_at")
        WHERE "expires_at" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_urls_expires_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_urls_short_key"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "urls"`);
  }
}
