import { Injectable } from '@nestjs/common';
import { Validate, ValidatorConstraint } from 'class-validator';
import type {
  ValidationArguments,
  ValidatorConstraintInterface,
} from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { checkOrganizationParent } from '../../organization/organization-hierarchy';

// Route context cannot be supplied or overwritten through the request body.
const organizationIds = new WeakMap<object, string>();

export function setOrganizationValidationContext(
  dto: object,
  id: string,
): void {
  if (!id.trim()) throw new Error('An organization ID is required');
  organizationIds.set(dto, id);
}

@Injectable()
@ValidatorConstraint({ name: 'validOrganizationParent', async: true })
export class ValidOrganizationParentConstraint implements ValidatorConstraintInterface {
  constructor(private readonly prisma: PrismaService) {}

  async validate(value: unknown, args: ValidationArguments): Promise<boolean> {
    const id = organizationIds.get(args.object);
    // Creation has no existing organization to reparent. Format and existence
    // checks belong to the other validators, including @Reference.
    if (!id || typeof value !== 'string' || !value.trim()) return true;
    const result = await checkOrganizationParent(id, value, (parentId) =>
      this.prisma.organization.findUnique({
        where: { id: parentId },
        select: { parentId: true },
      }),
    );
    return result !== 'cycle';
  }
}

export function ValidOrganizationParent(): PropertyDecorator {
  return Validate(ValidOrganizationParentConstraint);
}
