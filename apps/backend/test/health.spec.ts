import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Health API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(AuthService)
      .useValue({ auth: { handler: jest.fn() } })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService({ FRONTEND_URL: 'http://localhost:3000' }))
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
    expect(response.body.info.title).toBe('Tempo API');
    expect(response.body.paths).toHaveProperty('/api/health');
    expect(response.body.paths).not.toHaveProperty('/health');
    expect(
      response.body.paths['/api/health'].get.responses['200'].content[
        'application/json'
      ].schema,
    ).toEqual({
      type: 'object',
      required: ['success', 'message', 'data'],
      properties: {
        success: { type: 'boolean', enum: [true] },
        message: {
          type: 'string',
          enum: ['health_check_successful'],
          example: 'health_check_successful',
        },
        data: { $ref: '#/components/schemas/HealthDto' },
      },
    });
    expect(response.body.components.schemas.HealthDto).toEqual({
      type: 'object',
      properties: { status: { type: 'string', enum: ['ok'], example: 'ok' } },
      required: ['status'],
    });
  });
});
