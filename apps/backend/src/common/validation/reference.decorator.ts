import { ReferenceExistsConstraint } from './reference-exists.constraint';
import { Validate } from 'class-validator';
import type { Prisma } from '../../generated/prisma/client';

// Prisma model names become client properties: Organization -> organization.
export type ReferenceModel = Uncapitalize<Prisma.ModelName>;

/**
 * Validates that a string is a reference to an existing resource in the database.
 *
 * @param model
 * @constructor
 */
export function Reference(model: ReferenceModel): PropertyDecorator {
  return Validate(ReferenceExistsConstraint, [model]);
}
