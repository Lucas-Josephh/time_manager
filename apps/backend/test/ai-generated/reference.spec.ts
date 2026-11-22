import { ValidationArguments } from 'class-validator';
import { ReferenceExistsConstraint } from '../../src/common/validation/reference-exists.constraint';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Reference decorator constraint', () => {
  const findUnique = jest.fn();
  const validator = new ReferenceExistsConstraint({ user: { findUnique } } as unknown as PrismaService);
  const args = { constraints: ['user'] } as ValidationArguments;
  beforeEach(() => findUnique.mockReset());

  it.each([42, '', '  ', undefined, null])('leaves malformed values to format validators: %s', async (value) => {
    await expect(validator.validate(value, args)).resolves.toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('looks up the model declared by the decorator', async () => {
    findUnique.mockResolvedValue({ id: 'user-1' });
    await expect(validator.validate('user-1', args)).resolves.toBe(true);
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'user-1' }, select: { id: true } });
  });

  it('rejects missing references', async () => {
    findUnique.mockResolvedValue(null);
    await expect(validator.validate('missing', args)).resolves.toBe(false);
  });

  it('propagates database failures', async () => {
    const error = new Error('Database unavailable');
    findUnique.mockRejectedValue(error);
    await expect(validator.validate('user-1', args)).rejects.toBe(error);
  });
});
