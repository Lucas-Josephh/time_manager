import { fieldValidationException } from './validation-exception.factory';

/** The caller builds the query: this helper has no dependency on Prisma models. */
export async function requireUnique<T>(
  query: PromiseLike<T | null>,
  field: string,
): Promise<void> {
  const existing = await query;
  if (existing !== null) {
    throw fieldValidationException(field, 'already_exists');
  }
}
