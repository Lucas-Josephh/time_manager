// Conserve uniquement les propriétés Prisma ayant un findUnique.
import { PrismaService } from '../../prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import {
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export type ReferenceModel = {
  [K in keyof PrismaService]-?: PrismaService[K] extends { findUnique: unknown }
    ? K
    : never;
}[keyof PrismaService];

// Convention : les modèles utilisés ont un ID unique de type string.
type ReferenceDelegate = {
  findUnique(args: {
    where: { id: string };
    select: { id: true };
  }): Promise<{ id: string } | null>;
};

@Injectable()
@ValidatorConstraint({ name: 'referenceExists', async: true })
export class ReferenceExistsConstraint implements ValidatorConstraintInterface {
  constructor(private readonly prismaService: PrismaService) {}

  validate(
    value: unknown,
    args?: ValidationArguments,
  ): Promise<boolean> | boolean {
    if (typeof value !== 'string' || value.trim() === '') {
      return true;
    }

    const model = args?.constraints[0] as ReferenceModel;
    const delegate = this.prismaService[model] as unknown as ReferenceDelegate;

    return delegate
      .findUnique({ where: { id: value }, select: { id: true } })
      .then((result) => !!result)
      .catch(() => false);
  }
}

export function Reference(model: ReferenceModel): PropertyDecorator {
  return Validate(ReferenceExistsConstraint, [model]);
}