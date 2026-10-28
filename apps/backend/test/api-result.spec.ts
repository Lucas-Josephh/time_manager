import 'reflect-metadata';
import { Controller, Get, HttpStatus, Post } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ApiProperty, DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import request from 'supertest';
import { ApiResult } from '../src/common/decorator/api-result.decorator';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

@Exclude()
class ResultDto {
  @Expose()
  @ApiProperty()
  name!: string;
}

@Controller('result')
class ResultController {
  @Post()
  @ApiResult({ type: ResultDto, status: HttpStatus.ACCEPTED, message: 'result_created' })
  create() {
    return { name: 'test', secret: 'private' };
  }

  @Get()
  @ApiResult({ type: ResultDto, isArray: true })
  list() {
    return [{ name: 'test', secret: 'private' }];
  }

  @Get('empty')
  @ApiResult()
  empty() {}
}

it('keeps runtime status, envelope and serialization aligned with OpenAPI', async () => {
  const module = await Test.createTestingModule({ controllers: [ResultController] }).compile();
  const app = module.createNestApplication();
  app.useGlobalInterceptors(new ResponseInterceptor(new Reflector()));
  try {
    await app.init();
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build());
    await request(app.getHttpServer()).post('/result').expect(HttpStatus.ACCEPTED).expect({
      success: true, message: 'result_created', data: { name: 'test' },
    });
    await request(app.getHttpServer()).get('/result').expect(HttpStatus.OK).expect({
      success: true, message: 'request_successful', data: [{ name: 'test' }],
    });
    await request(app.getHttpServer()).get('/result/empty').expect(HttpStatus.OK).expect({
      success: true, message: 'request_successful', data: {},
    });
    expect(document.paths['/result'].post?.responses['202']).toMatchObject({
      content: { 'application/json': { schema: { properties: {
        message: { enum: ['result_created'] },
        data: { $ref: '#/components/schemas/ResultDto' },
      } } } },
    });
    expect(document.paths['/result'].get?.responses['200']).toMatchObject({
      content: { 'application/json': { schema: { properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/ResultDto' } },
      } } } },
    });
  } finally {
    await app.close();
  }
});
