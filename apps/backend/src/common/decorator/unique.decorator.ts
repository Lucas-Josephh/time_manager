import { Injectable } from '@nestjs/common';
import { Validate, ValidatorConstraint } from 'class-validator';
import type {
  ValidationArguments,
  ValidatorConstraintInterface,
} from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import type { ReferenceModel } from './reference.decorator';

type UniqueField<M extends ReferenceModel> = Exclude<
  Extract<
    keyof NonNullable<
      NonNullable<Parameters<PrismaService[M]['findFirst']>[0]>['where']
    >,
    string
  >,
  'AND' | 'OR' | 'NOT'
>;

type UniqueDelegate = {
  findFirst(args: {
    where: Record<string, unknown>;
    select: { id: true };
  }): Promise<{ id: string } | null>;
};

// Le body ne peut pas renseigner ce contexte : seul le serveur le fournit.
const excludedRecords = new WeakMap<object, Map<ReferenceModel, string>>();

/** À appeler sur l'instance du DTO avant validate(), avec l'ID de la route. */
export function excludeUniqueRecord(
  dto: object,
  model: ReferenceModel,
  id: string,
): void {
  if (!id.trim()) {
    throw new Error('An ID is required to exclude a record from uniqueness validation');
  }
  const records = excludedRecords.get(dto) ?? new Map<ReferenceModel, string>();
  records.set(model, id);
  excludedRecords.set(dto, records);
}

@Injectable()
@ValidatorConstraint({ name: 'isUnique', async: true })
export class UniqueConstraint implements ValidatorConstraintInterface {
  constructor(private readonly prisma: PrismaService) {}

  async validate(value: unknown, args: ValidationArguments): Promise<boolean> {
    // Les règles de format produisent leur propre erreur, sans requête en base.
    if (typeof value !== 'string' || value.trim() === '') {
      return true;
    }

    const [model, field] = args.constraints as [ReferenceModel, string];
    const excludedId = excludedRecords.get(args.object)?.get(model);
    const where: Record<string, unknown> = { [field]: value };
    if (excludedId) {
      where.id = { not: excludedId };
    }

    // Convention commune à Reference : clé primaire id de type string.
    const delegate = this.prisma[model] as unknown as UniqueDelegate;
    const existing = await delegate.findFirst({
      where,
      select: { id: true },
    });

    return existing === null;
  }
}

export function Unique<M extends ReferenceModel>(
  model: M,
  field: UniqueField<M>,
): PropertyDecorator {
  return Validate(UniqueConstraint, [model, field]);
}
