import { UniqueConstraint } from './unique.constraint';
import { uniqueValidationRequest } from './validation-request.context';
import { Validate } from 'class-validator';
import type { Prisma } from '../../generated/prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ReferenceModel } from './reference.decorator';

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

export type UniqueRule = {
  model: ReferenceModel;
  field: string;
  filter: Record<string, unknown> | ((context: UniqueContext) => Record<string, unknown>);
};

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
