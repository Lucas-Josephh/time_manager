import { Injectable } from '@nestjs/common';
import { Validate, ValidatorConstraint } from 'class-validator';
import type { ValidationArguments, ValidatorConstraintInterface } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';

// Prisma model names become client properties: Organization -> organization.
export type ReferenceModel = Uncapitalize<Prisma.ModelName>;

// All referenced models use a unique string primary key named id.
type ReferenceDelegate = {
  findUnique(args: {
    where: { id: string };
    select: { id: true };
  }): PromiseLike<{ id: string } | null>;
};

@Injectable()
@ValidatorConstraint({ name: 'referenceExists', async: true })
export class ReferenceExistsConstraint implements ValidatorConstraintInterface {
  constructor(private readonly prisma: PrismaService) {}

  async validate(value: unknown, args: ValidationArguments): Promise<boolean> {
    // Format errors are handled by @IsString and @IsNotEmpty.
    if (typeof value !== 'string' || !value.trim()) return true;

    const [model] = args.constraints as [ReferenceModel];
    const delegate = this.prisma[model] as unknown as ReferenceDelegate;
    const resource = await delegate.findUnique({
      where: { id: value },
      select: { id: true },
    });
    // Database errors propagate; an outage is not a missing reference.
    return resource !== null;
  }
}

export function Reference(model: ReferenceModel): PropertyDecorator {
  return Validate(ReferenceExistsConstraint, [model]);
}
