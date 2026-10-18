import { NotFoundException } from '@nestjs/common';

/** Réutilise la requête métier pour vérifier l'existence sans requête supplémentaire. */
export async function requireResource<T>(
  query: PromiseLike<T | null>,
): Promise<T> {
  const resource = await query;
  if (resource === null) {
    throw new NotFoundException('not_found');
  }
  return resource;
}
