import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Health API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the health response under the global API prefix', async () => {
    await request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({
        success: true,
        message: 'health_check_successful',
        data: { status: 'ok' },
      });
  });

  it('does not expose an unprefixed health route', async () => {
    await request(app.getHttpServer()).get('/health').expect(404);
  });

  it('serves Swagger UI and its assets under the API prefix', async () => {
    await request(app.getHttpServer())
      .get('/api/docs/')
      .expect(200)
      .expect('Content-Type', /html/);
    await request(app.getHttpServer())
      .get('/api/docs/swagger-ui-bundle.js')
      .expect(200)
      .expect('Content-Type', /javascript/);
  });

  it('documents the prefixed health route and its response', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    expect(response.body.info.title).toBe('Time Manager API');
    expect(response.body.paths).toHaveProperty('/api/health');
    expect(response.body.paths).not.toHaveProperty('/health');
    expect(
      response.body.paths['/api/health'].get.responses['200'].content[
        'application/json'
      ].schema,
    ).toEqual({
      type: 'object',
      properties: { status: { type: 'string', enum: ['ok'], example: 'ok' } },
    });
  });
});
