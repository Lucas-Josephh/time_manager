import { validate, useContainer } from 'class-validator';
import { Unique, UniqueConstraint } from '../src/common/decorator/unique.decorator';
import { PrismaService } from '../src/prisma/prisma.service';

class ScopedTeamDto {
  @Unique('team', 'name', { organizationId: 'organization-1' })
  name = 'Support';
}

class FilteredTeamDto {
  @Unique('team', 'name', { name: { not: 'Support' } })
  name = 'Support';
}

describe('Unique Prisma filters', () => {
  const findFirst = jest.fn();

  beforeEach(() => {
    findFirst.mockReset().mockResolvedValue(null);
    const constraint = new UniqueConstraint({ team: { findFirst } } as unknown as PrismaService);
    useContainer({
      get: (type: new () => unknown) => type === UniqueConstraint ? constraint : new type(),
    });
  });

  afterEach(() => useContainer({ get: (type: new () => unknown) => new type() }));

  it('checks uniqueness within a fixed scope and rejects duplicates', async () => {
    findFirst.mockResolvedValue({ id: 'existing-team' });
    const errors = await validate(new ScopedTeamDto());
    expect(errors).toHaveLength(1);
    expect(findFirst).toHaveBeenCalledWith({
      where: { AND: [{ name: 'Support' }, { organizationId: 'organization-1' }] },
      select: { id: true },
    });
  });

  it('keeps the value condition when the filter also references the unique field', async () => {
    expect(await validate(new FilteredTeamDto())).toEqual([]);
    expect(findFirst).toHaveBeenCalledWith({
      where: { AND: [{ name: 'Support' }, { name: { not: 'Support' } }] },
      select: { id: true },
    });
  });
});
