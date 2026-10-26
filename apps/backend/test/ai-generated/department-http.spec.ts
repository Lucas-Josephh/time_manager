import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHttpTestApp } from './support/http-test-app';

// Organization CRUD coverage lives in organization/.
describe('Removed department API', () => {
  let app: INestApplication;
  beforeAll(async () => { app = await createHttpTestApp({}); });
  afterAll(async () => { await app.close(); });

  it.each(['/api/departments', '/api/departments/old-department'])(
    'does not expose the obsolete route %s', async (path) => {
      await request(app.getHttpServer()).get(path).expect(404)
        .expect({ success: false, message: 'not_found', data: {} });
    },
  );
});
