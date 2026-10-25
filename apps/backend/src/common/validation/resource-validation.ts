import { fieldValidationException } from './validation-exception.factory';

type UniqueFieldDelegate = {
  findFirst(args: {
    where: Record<string, string | { not: string }>;
    select: { id: true };
  }): PromiseLike<{ id: string } | null>;
};

/**
 * Asserts that a given field value is unique in the database.
 *
 * @param model
 * @param options
 */
export async function assertUniqueField(
  model: UniqueFieldDelegate,
  options: { field: string; value: string; excludeId?: string },
): Promise<void> {
  const { field, value, excludeId } = options;
  const existing = await model.findFirst({
    where: {
      [field]: value,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (existing !== null) {
    throw fieldValidationException(field, 'already_exists');
  }
}
