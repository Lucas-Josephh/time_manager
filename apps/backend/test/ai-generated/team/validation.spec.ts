import request from 'supertest';
import { useTeamFixture } from './team.fixture';

describe('Team HTTP API: validation', () => {
  const context = useTeamFixture();
  const { prisma, dto, envelope } = context;
  it.each(['put', 'patch'] as const)(
    'returns 404 before DTO validation for a missing team in %s',
    async (method) => {
      prisma.team.findUnique.mockResolvedValue(null);
      prisma.team.findFirst.mockResolvedValue({ id: 'other-team' });
      await request(context.app.getHttpServer())
        [method]('/api/team/missing')
        .send({ name: 42, organizationId: 42, unexpected: true })
        .expect(404)
        .expect(envelope('not_found', {}, false));
      expect(prisma.team.findFirst).not.toHaveBeenCalled();
      expect(prisma.organization.findUnique).not.toHaveBeenCalled();
      expect(prisma.team.update).not.toHaveBeenCalled();
    },
  );

  it.each(['put', 'patch'] as const)(
    'still validates the DTO when the target exists in %s',
    async (method) => {
      await request(context.app.getHttpServer())
        [method]('/api/team/team-support')
        .send({ name: 42 })
        .expect(400);
      expect(prisma.team.update).not.toHaveBeenCalled();
    },
  );

  it.each([
    [{ organizationId: dto.organizationId }, 'name', 'is_required'],
    [{ name: 'Support' }, 'organizationId', 'is_required'],
    [{ ...dto, name: '   ' }, 'name', 'is_required'],
    [{ ...dto, name: 42 }, 'name', 'need_string'],
    [{ ...dto, name: 'a'.repeat(256) }, 'name', 'max_length_exceeded'],
    [{ ...dto, managerId: 42 }, 'managerId', 'need_string'],
    [{ ...dto, managerId: '' }, 'managerId', 'is_required'],
    [{ ...dto, organizationId: 42 }, 'organizationId', 'need_string'],
    [{ ...dto, id: 'injected-id' }, 'id', 'validation_unknown_field'],
  ])('rejects invalid creation %#', async (body, field, code) => {
    const response = await request(context.app.getHttpServer())
      .post('/api/team')
      .send(body)
      .expect(400);
    expect(response.body).toEqual(
      envelope(
        'validation_failed',
        { errors: [{ field, messages: [code] }] },
        false,
      ),
    );
    expect(prisma.team.create).not.toHaveBeenCalled();
  });

  it.each(['organizationId', 'managerId'])(
    'rejects an unknown %s',
    async (field) => {
      if (field === 'organizationId') {
        prisma.organization.findUnique.mockResolvedValue(null);
      } else {
        prisma.user.findUnique.mockImplementation(async ({ where }) =>
          where.id === 'missing' ? null : { id: where.id, isAdmin: true },
        );
      }
      await request(context.app.getHttpServer())
        .post('/api/team')
        .send({ ...dto, [field]: 'missing' })
        .expect(400)
        .expect(
          envelope(
            'validation_failed',
            { errors: [{ field, messages: ['reference_not_found'] }] },
            false,
          ),
        );
      expect(prisma.team.create).not.toHaveBeenCalled();
    },
  );
});
