import { NotFoundException } from '@nestjs/common';

/**
 * Require a resource to exist, otherwise throw a NotFoundException.
 *
 * @param query
 */
export async function requireResource<T>(
  query: PromiseLike<T | null>,
): Promise<T> {
  const resource = await query;
  if (resource === null) {
    throw new NotFoundException();
  }
  return resource;
}
