import { requireUnique } from '../../src/common/validation/resource-validation';

describe('Explicit resource validation', () => {
  it('accepts a free unique value', async () => {
    await expect(requireUnique(Promise.resolve(null), 'slug')).resolves.toBeUndefined();
  });

  it('reports an existing value on the supplied field', async () => {
    await expect(requireUnique(Promise.resolve({ id: 'other' }), 'slug'))
      .rejects.toMatchObject({ response: {
        message: 'validation_failed',
        data: { errors: [{ field: 'slug', messages: ['already_exists'] }] },
      } });
  });

  it('does not disguise database failures as validation errors', async () => {
    const error = new Error('Database unavailable');
    await expect(requireUnique(Promise.reject(error), 'slug')).rejects.toBe(error);
  });
});
