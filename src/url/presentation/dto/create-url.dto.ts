import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUrl, IsOptional, IsDateString } from 'class-validator';

export class CreateUrlDto {
  @ApiProperty({
    example: 'https://www.google.com',
    description: '단축할 원본 URL',
  })
  @IsUrl({}, { message: '유효한 URL을 입력해주세요' })
  originalUrl: string;

  @ApiPropertyOptional({
    example: '2026-12-31T23:59:59.000Z',
    description: 'URL 만료 일시',
  })
  @IsDateString()
  @IsOptional()
  expiresAt?: Date;
}
