import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { UrlService } from '../application/url.service';
import { CreateUrlDto } from './dto/create-url.dto';

@ApiTags('url')
@Controller()
export class UrlController {
  constructor(private readonly urlService: UrlService) {}

  @ApiOperation({ summary: '단축 URL 생성' })
  @ApiResponse({
    status: 201,
    description: '생성 성공',
    schema: { example: { shortUrl: 'http://localhost:3000/1' } },
  })
  @ApiResponse({ status: 400, description: '유효하지 않은 URL' })
  @Post('shorten')
  async shorten(@Body() dto: CreateUrlDto): Promise<{ shortUrl: string }> {
    return this.urlService.create(dto);
  }

  @ApiOperation({ summary: '단축 URL 리다이렉트' })
  @ApiParam({ name: 'shortKey', example: '1a2B3c' })
  @ApiResponse({ status: 302, description: '원본 URL로 리다이렉트' })
  @ApiResponse({ status: 404, description: '존재하지 않는 단축 URL' })
  @ApiResponse({ status: 410, description: '만료된 URL' })
  @Get(':shortKey')
  async redirect(
    @Param('shortKey') shortKey: string,
    @Res() res: Response,
  ): Promise<void> {
    const originalUrl = await this.urlService.getOriginalUrl(shortKey);
    res.redirect(302, originalUrl);
  }
}
