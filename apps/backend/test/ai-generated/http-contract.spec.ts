import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHttpTestApp } from './http-test-app';

describe('HTTP configuration', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createHttpTestApp({});
  });
  afterAll(async () => {
    await app.close();
  });

  it('allows credentialed responses for the configured frontend', async () => {
    await request(app.getHttpServer())
      .get('/api/health')
      .set('Origin', 'http://localhost:3000')
      .expect(200)
      .expect('Access-Control-Allow-Origin', 'http://localhost:3000')
      .expect('Access-Control-Allow-Credentials', 'true');
  });

  it('answers browser preflight requests', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/team')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'PATCH')
      .set('Access-Control-Request-Headers', 'content-type')
      .expect(204)
      .expect('Access-Control-Allow-Origin', 'http://localhost:3000')
      .expect('Access-Control-Allow-Credentials', 'true')
      .expect('Access-Control-Allow-Headers', 'content-type');
    expect(
      response.headers['access-control-allow-methods'].split(','),
    ).toContain('PATCH');
  });

  it('does not grant a different origin access to credentialed responses', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .set('Origin', 'https://untrusted.example')
      .expect(200);
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000',
    );
  });

  it('wraps unknown routes in the standard error envelope', async () => {
    await request(app.getHttpServer())
      .get('/api/unknown-route')
      .expect(404)
      .expect({ success: false, message: 'not_found', data: {} });
  });
});
