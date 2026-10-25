import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { Validate, ValidatorConstraint } from 'class-validator';
import type {
  ValidationArguments,
  ValidatorConstraintInterface,
} from 'class-validator';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ReferenceModel } from './reference.decorator';

// Each request has its own context, including concurrent requests.
export const uniqueValidationRequest = new AsyncLocalStorage<{
  method: string;
  params: Record<string, unknown>;
}>();

type UniqueRequest = NonNullable<ReturnType<typeof uniqueValidationRequest.getStore>>;
type UniqueContext = { request: UniqueRequest | undefined; object: object };

type UniqueWhere<Model extends ReferenceModel> = NonNullable<
  Prisma.Args<PrismaService[Model], 'findFirst'>['where']
>;

/** A Prisma filter, optionally computed from the current validation context. */
type UniqueFilter<Model extends ReferenceModel> =
  | UniqueWhere<Model>
  | ((context: UniqueContext) => UniqueWhere<Model>);

// Restrict the field name to columns of the selected Prisma model.
type UniqueField<Model extends ReferenceModel> = keyof PrismaService[Model]['fields'];

type UniqueRule = {
  model: ReferenceModel;
  field: string;
  filter: Record<string, unknown> | ((context: UniqueContext) => Record<string, unknown>);
};

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

/**
 * A decorator that checks if a given field value is unique in the database for a specified model.
 *
 * @param model The Prisma model to check for uniqueness.
 * @param field The field to check for uniqueness.
 * @param filter Optional additional filter to apply when checking for uniqueness.
 * @constructor
 */
export function Unique<Model extends ReferenceModel>(
  model: Model,
  field: UniqueField<Model>,
  filter: UniqueFilter<Model> = {},
): PropertyDecorator {
  return Validate(UniqueConstraint, [{ model, field, filter }]);
}
