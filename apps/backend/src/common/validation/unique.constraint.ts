import { Injectable } from '@nestjs/common';
import { ValidatorConstraint, type ValidationArguments, type ValidatorConstraintInterface } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { uniqueValidationRequest } from './validation-request.context';
import type { UniqueRule } from './unique.decorator';

// Shared interface for querying Prisma models.
type UniqueDelegate = {
  findFirst(args: {
    where: Record<string, unknown>;
    select: { id: true };
  }): Promise<{ id: string } | null>;
};

@Injectable()
@ValidatorConstraint({ name: 'isUnique', async: true })
export class UniqueConstraint implements ValidatorConstraintInterface {
  constructor(private readonly prisma: PrismaService) {}

  async validate(value: unknown, args: ValidationArguments): Promise<boolean> {
    // Other decorators validate the type and reject empty values.
    if (typeof value !== 'string' || value.trim() === '') return true;

    const { model, field, filter } = args.constraints[0] as UniqueRule;
    const extraWhere = typeof filter === 'function'
      ? filter({ request: uniqueValidationRequest.getStore(), object: args.object })
      : filter;
    const where = Object.keys(extraWhere).length
      ? { AND: [{ [field]: value }, extraWhere] }
      : { [field]: value };

    const delegate = this.prisma[model] as unknown as UniqueDelegate;
    const existing = await delegate.findFirst({ where, select: { id: true } });
    return existing === null;
  }
}
