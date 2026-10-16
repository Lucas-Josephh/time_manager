import { NotFoundException } from '@nestjs/common';
import type { ReferenceModel } from './decorator/reference.decorator';

/** Réutilise la requête métier pour vérifier l'existence sans requête supplémentaire. */
export async function requireResource<T>(
  query: PromiseLike<T | null>,
  model: ReferenceModel,
): Promise<T> {
  const resource = await query;
  if (resource === null) {
    const name = model.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
    throw new NotFoundException(`${name}_not_found`);
  }
  return resource;
}
