import { NotFoundException } from '@nestjs/common';

export class UrlNotFoundException extends NotFoundException {
  constructor(shortKey: string) {
    super(`단축 URL을 찾을 수 없습니다: ${shortKey}`);
  }
}
