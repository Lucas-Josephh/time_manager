import { assertUniqueField } from '../../src/common/validation/resource-validation';

describe('Unique field validation', () => {
  const model = { findFirst: jest.fn() };
  const options = { field: 'slug', value: 'engineering' };

  beforeEach(() => model.findFirst.mockReset());

  it('accepts a free value and query only the requested field', async () => {
    model.findFirst.mockResolvedValue(null);
    await expect(assertUniqueField(model, options)).resolves.toBeUndefined();
    expect(model.findFirst).toHaveBeenCalledWith({
      where: { slug: 'engineering' },
      select: { id: true },
    });
  });

  it('excludes the current record when updating', async () => {
    model.findFirst.mockResolvedValue(null);
    await assertUniqueField(model, { ...options, excludeId: 'current' });
    expect(model.findFirst).toHaveBeenCalledWith({
      where: { slug: 'engineering', id: { not: 'current' } },
      select: { id: true },
    });
  });

  it('reports an existing value on the supplied field', async () => {
    model.findFirst.mockResolvedValue({ id: 'other' });
    await expect(assertUniqueField(model, options)).rejects.toMatchObject({
      response: {
        message: 'validation_failed',
        data: { errors: [{ field: 'slug', messages: ['already_exists'] }] },
      },
    });
  });

  it('propagates database failures', async () => {
    const error = new Error('Database unavailable');
    model.findFirst.mockRejectedValue(error);
    await expect(assertUniqueField(model, options)).rejects.toBe(error);
  });
});
