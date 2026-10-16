import request from 'supertest';
import { useTeamFixture } from './team.fixture';

describe('Team HTTP API: validation', () => {
  const context = useTeamFixture();
  const { prisma, dto, envelope } = context;
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
      (field === 'organizationId'
        ? prisma.organization
        : prisma.user
      ).findUnique.mockResolvedValue(null);
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
