import { mockFindUniqueOrThrow } from './support/mock-find-unique-or-throw';
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { createHttpTestApp } from './ai-generated/support/http-test-app';

describe('Shared list pagination', () => {
  let app: INestApplication;
  const delegate = () => ({ findMany: jest.fn(), count: jest.fn(), findUniqueOrThrow: mockFindUniqueOrThrow, findUnique: jest.fn() });
  const prisma = {
    user: delegate(), team: delegate(), organization: delegate(),
    $transaction: jest.fn(),
  };
  beforeAll(async () => { app = await createHttpTestApp(prisma); });
  afterAll(async () => { await app.close(); });
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.user.findUnique.mockResolvedValue({ id: 'admin', isAdmin: true });
    prisma.$transaction.mockImplementation(queries => Promise.all(queries));
  });

  describe.each([
    ['/api/users', 'user', 'firstname', 'UserListDto'],
    ['/api/team', 'team', 'name', 'TeamListDto'],
    ['/api/organizations', 'organization', 'name', 'OrganizationListDto'],
  ] as const)('%s', (url, model, filter, schema) => {
    it('paginates filtered results and serializes nested items', async () => {
      const rows = Array.from({ length: 25 }, (_, i) => ({
        id: `item-${i}`, name: 'Match', firstname: 'Match', lastname: 'Tester',
        internal: 'private',
      }));
      prisma[model].findMany.mockImplementation(({ skip, take }) => Promise.resolve(rows.slice(skip, skip + take)));
      prisma[model].count.mockResolvedValue(rows.length);
      const response = await request(app.getHttpServer()).get(url)
        .query({ page: 3, limit: 10, [filter]: ' Match ' }).expect(200);
      expect(response.body.data.meta).toEqual({ total: 25, page: 3, limit: 10, totalPages: 3 });
      expect(response.body.data.items.map((item: { id: string }) => item.id))
        .toEqual(['item-20', 'item-21', 'item-22', 'item-23', 'item-24']);
      expect(response.body.data.items[0]).not.toHaveProperty('internal');
      const where = { [filter]: { contains: 'Match', mode: 'insensitive' } };
      expect(prisma[model].count).toHaveBeenCalledWith({ where });
      expect(prisma[model].findMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: 20, take: 10 }));
      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Array), { isolationLevel: 'RepeatableRead' });
    });

    it.each([0, 25])('returns an empty page with a filtered total of %i', async total => {
      prisma[model].findMany.mockResolvedValue([]);
      prisma[model].count.mockResolvedValue(total);
      const response = await request(app.getHttpServer()).get(url)
        .query({ page: 5, limit: 10 }).expect(200);
      expect(response.body.data).toEqual({ items: [], meta: {
        total, page: 5, limit: 10, totalPages: Math.ceil(total / 10),
      } });
    });

    it.each([{ page: 0 }, { page: 1.5 }, { page: 'abc' }, { limit: 0 }, { limit: 101 }, { limit: 2.5 }])(
      'rejects invalid pagination %j before reading', async query => {
        await request(app.getHttpServer()).get(url).query(query).expect(400);
        expect(prisma[model].findMany).not.toHaveBeenCalled();
        expect(prisma[model].count).not.toHaveBeenCalled();
      },
    );

    it('documents page parameters and the concrete response item schema', () => {
      const document = SwaggerModule.createDocument(app, new DocumentBuilder().build());
      expect(document.paths[url].get?.parameters).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'page', in: 'query' }),
        expect.objectContaining({ name: 'limit', in: 'query' }),
      ]));
      expect(document.paths[url].get?.responses['200']).toMatchObject({
        content: { 'application/json': { schema: { properties: {
          data: { $ref: `#/components/schemas/${schema}` },
        } } } },
      });
      expect(document.components?.schemas?.[schema]).toMatchObject({ properties: {
        items: { type: 'array' }, meta: { $ref: '#/components/schemas/PaginationMetaDto' },
      } });
    });
  });

  it('keeps organization trees separate from page-based list queries', async () => {
    await request(app.getHttpServer()).get('/api/organizations/tree?page=1').expect(400);
    expect(prisma.organization.findMany).not.toHaveBeenCalled();
  });
});
