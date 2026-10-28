import { Injectable } from '@nestjs/common';
import { ValidatorConstraint, type ValidationArguments, type ValidatorConstraintInterface } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import type { ReferenceModel } from './reference.decorator';

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
