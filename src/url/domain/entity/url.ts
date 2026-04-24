export class Url {
  constructor(
    public readonly id: string,
    public readonly originalUrl: string,
    public readonly shortKey: string,
    public readonly expiresAt: Date | null,
    public readonly viewCount: number,
    public readonly createdAt: Date,
  ) {}

  isExpired(): boolean {
    return this.expiresAt !== null && this.expiresAt < new Date();
  }
}
