import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import request from 'supertest';
import { createHttpTestApp } from './support/http-test-app';

describe('Organization tree HTTP API', () => {
  let app: INestApplication;
  let admin = false;
  let authenticated = true;
  let rows: ReturnType<typeof org>[];
  const org = (
    id: string,
    parentId: string | null = null,
    managerId: string | null = null,
    name = id,
  ) => ({
    id,
    name,
    parentId,
    managerId,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    secret: 'private',
  });
  const prisma = {
    user: { findUnique: jest.fn(async () => ({ isAdmin: admin })) },
    organization: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => rows.find(row => row.id === where.id) ?? null),
      findMany: jest.fn(async ({ where }: any) =>
        rows.filter((row) =>
          where.id !== undefined
            ? row.id === where.id
            : where.managerId !== undefined
              ? row.managerId === where.managerId
              : where.parentId === null
                ? row.parentId === null
                : where.parentId.in.includes(row.parentId),
        ),
      ),
    },
    $transaction: jest.fn(
      async (callback: any, _options: any): Promise<unknown> =>
        callback(prisma),
    ),
  };
  beforeAll(async () => {
    app = await createHttpTestApp(prisma, async () => {
      if (!authenticated) throw new UnauthorizedException();
      return { user: { id: 'test-user' } };
    });
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    admin = false;
    authenticated = true;
    rows = [
      org('ancestor'),
      org('managed', 'ancestor', 'test-user'),
      org('child', 'managed'),
      org('deep', 'child', 'test-user'),
      org('neighbor', 'ancestor'),
      org('isolated'),
    ];
    jest.clearAllMocks();
  });
  const get = (query = '') =>
    request(app.getHttpServer()).get('/api/organizations/tree' + query);

  const subtree = (id: string) =>
    request(app.getHttpServer()).get(
      '/api/organizations/' + encodeURIComponent(id) + '/tree',
    );

  it('returns only managed branches, deduplicates nested management and serializes deeply', async () => {
    const { body } = await get().expect(200);
    expect(body.data.map((node: any) => node.id)).toEqual(['managed']);
    expect(body.data[0].children[0].children[0]).toMatchObject({
      id: 'deep',
      children: [],
    });
    expect(JSON.stringify(body)).not.toContain('secret');
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'RepeatableRead',
    });
  });
  it('returns an authorized subtree including its parent', async () => {
    const { body } = await subtree('child').expect(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe('child');
    expect(body.data[0].children[0].id).toBe('deep');
  });
  it.each(['ancestor', 'neighbor', 'missing'])(
    'hides inaccessible parent %s',
    async (id) => {
      await subtree(id).expect(404);
    },
  );
  it('denies a user without organization management regardless of attachment or team roles', async () => {
    rows = rows.map((row) => ({ ...row, managerId: null }));
    await get().expect(403);
  });
  it('supports several disjoint managed roots and orders siblings by name then id', async () => {
    rows.push(
      org('other', null, 'test-user', 'AAA'),
      org('z', 'managed', null, 'same'),
      org('a', 'managed', null, 'same'),
    );
    const { body } = await get().expect(200);
    expect(body.data.map((node: any) => node.id)).toEqual(['other', 'managed']);
    expect(body.data[1].children.map((node: any) => node.id)).toEqual([
      'child',
      'a',
      'z',
    ]);
  });
  it('returns all roots for administrators and an isolated subtree', async () => {
    admin = true;
    const { body } = await get().expect(200);
    expect(body.data.map((node: any) => node.id)).toEqual([
      'ancestor',
      'isolated',
    ]);
    const isolated = await subtree('isolated').expect(200);
    expect(isolated.body.data[0].children).toEqual([]);
    await subtree('missing').expect(404);
  });
  it('returns an empty array for an empty administrator forest', async () => {
    admin = true;
    rows = [];
    expect((await get().expect(200)).body.data).toEqual([]);
  });
  it.each([
    '?parentId=',
    '?parentId=%20',
    '?parentId=a&parentId=b',
    '?name=%20',
    '?name=a&name=b',
  ])('rejects invalid query %s', async (query) => {
    await get(query).expect(400);
  });
  it('also supports targeting a subtree via the tree query', async () => {
    const query = await get('?parentId=child').expect(200);
    const path = await subtree('child').expect(200);
    expect(query.body.data).toEqual(path.body.data);
  });
  it('searches names without case sensitivity and retains authorized ancestors only', async () => {
    rows.push(org('unrelated', 'managed'));
    const { body } = await get('?name=%20DEeP%20').expect(200);
    expect(body.data.map((node: any) => node.id)).toEqual(['managed']);
    expect(body.data[0].children.map((node: any) => node.id)).toEqual([
      'child',
    ]);
    expect(body.data[0].children[0].children[0].id).toBe('deep');
    expect((await get('?name=neighbor').expect(200)).body.data).toEqual([]);
  });
  it('combines a name search with a root in either tree route', async () => {
    const query = await get('?parentId=child&name=deep').expect(200);
    const path = await request(app.getHttpServer())
      .get('/api/organizations/child/tree?name=deep')
      .expect(200);
    expect(query.body.data).toEqual(path.body.data);
    expect(query.body.data[0].id).toBe('child');
    expect(
      (await get('?parentId=child&name=missing').expect(200)).body.data,
    ).toEqual([]);
    await get('?parentId=neighbor&name=missing').expect(404);
  });
  it('combines the standard name and manager filters without widening access', async () => {
    const { body } = await get('?name=deep&managerId=test-user').expect(200);
    expect(body.data[0].children[0].children[0].id).toBe('deep');
    expect((await get('?name=deep&managerId=other').expect(200)).body.data).toEqual([]);
    rows.push(org('private', null, 'other', 'deep'));
    expect((await get('?managerId=other').expect(200)).body.data).toEqual([]);
  });
  it('requires a session', async () => {
    authenticated = false;
    await get().expect(401);
  });
  it('documents recursive arrays and error responses', () => {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    const route = doc.paths['/api/organizations/tree'].get!;
    expect(Object.keys(route.responses)).toEqual(
      expect.arrayContaining(['200', '400', '401', '403', '404', '500']),
    );
    expect(route.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ in: 'query', name: 'parentId' }),
        expect.objectContaining({ in: 'query', name: 'name' }),
      ]),
    );
    const subtreeRoute = doc.paths['/api/organizations/{id}/tree'].get!;
    expect(Object.keys(subtreeRoute.responses)).toEqual(
      expect.arrayContaining(['200', '401', '403', '404', '500']),
    );
    expect(subtreeRoute.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ in: 'path', name: 'id', required: true }),
      ]),
    );
    expect(
      (
        doc.components!.schemas!
          .OrganizationTreeDto as import('@nestjs/swagger/dist/interfaces/open-api-spec.interface').SchemaObject
      ).properties!.children,
    ).toEqual({
      type: 'array',
      items: { $ref: '#/components/schemas/OrganizationTreeDto' },
    });
  });
});
