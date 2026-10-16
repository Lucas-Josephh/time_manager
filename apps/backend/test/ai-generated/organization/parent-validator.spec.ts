import type { ValidationArguments } from 'class-validator';
import { ValidOrganizationParentConstraint, setOrganizationValidationContext } from '../../../src/common/decorator/valid-organization-parent.decorator';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('ValidOrganizationParent', () => {
  const findUnique = jest.fn();
  const validator = new ValidOrganizationParentConstraint({ organization: { findUnique } } as unknown as PrismaService);
  const args = (object: object) => ({ object } as ValidationArguments);
  beforeEach(() => { findUnique.mockReset(); });

  it('uses server context instead of a body-supplied identifier', async () => {
    const dto = { id: 'spoofed', parentId: 'actual' };
    setOrganizationValidationContext(dto, 'actual');
    await expect(validator.validate('actual', args(dto))).resolves.toBe(false);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('does not share route context between DTO instances', async () => {
    const first = {};
    const second = {};
    setOrganizationValidationContext(first, 'a');
    await expect(validator.validate('a', args(second))).resolves.toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it.each([null, undefined, '', 42])('leaves optional and malformed values to other validators: %s', async (value) => {
    const dto = {};
    setOrganizationValidationContext(dto, 'a');
    await expect(validator.validate(value, args(dto))).resolves.toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('leaves missing references to the reference validator', async () => {
    const dto = {};
    setOrganizationValidationContext(dto, 'a');
    findUnique.mockResolvedValue(null);
    await expect(validator.validate('missing', args(dto))).resolves.toBe(true);
  });

  it('stops on an already cyclic ancestor chain', async () => {
    const dto = {};
    setOrganizationValidationContext(dto, 'a');
    findUnique.mockImplementation(async ({ where }) => ({ parentId: where.id === 'b' ? 'c' : 'b' }));
    await expect(validator.validate('b', args(dto))).resolves.toBe(false);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('does not report a database outage as a validation error', async () => {
    const dto = {};
    setOrganizationValidationContext(dto, 'a');
    findUnique.mockRejectedValue(new Error('Database unavailable'));
    await expect(validator.validate('b', args(dto))).rejects.toThrow('Database unavailable');
  });
});
