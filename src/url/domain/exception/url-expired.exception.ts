import { GoneException } from '@nestjs/common';

export class UrlExpiredException extends GoneException {
  constructor(shortKey: string) {
    super(`만료된 URL입니다: ${shortKey}`);
  }
}
