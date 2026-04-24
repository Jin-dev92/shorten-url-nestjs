import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Url } from '../../domain/entity/url';
import { UrlRepository } from '../../domain/repository/url.repository';
import { UrlOrmEntity } from './url.orm-entity';

@Injectable()
export class UrlTypeormRepository extends UrlRepository {
  constructor(
    @InjectRepository(UrlOrmEntity)
    private readonly repo: Repository<UrlOrmEntity>,
  ) {
    super();
  }

  private toDomain(orm: UrlOrmEntity): Url {
    return new Url(
      orm.id,
      orm.originalUrl,
      orm.shortKey,
      orm.expiresAt,
      Number(orm.viewCount),
      orm.createdAt,
    );
  }

  async findByShortKey(shortKey: string): Promise<Url | null> {
    const orm = await this.repo.findOne({ where: { shortKey } });
    return orm ? this.toDomain(orm) : null;
  }

  async saveWithKey(data: {
    originalUrl: string;
    expiresAt: Date | null;
    shortKey: string;
  }): Promise<void> {
    const orm = this.repo.create(data);
    await this.repo.save(orm);
  }

  async incrementViewCount(shortKey: string, count: number): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(UrlOrmEntity)
      .set({ viewCount: () => `"view_count" + ${count}` })
      .where('short_key = :shortKey', { shortKey })
      .execute();
  }

  async deleteExpired(): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .delete()
      .from(UrlOrmEntity)
      .where('expires_at < NOW()')
      .execute();
  }
}
