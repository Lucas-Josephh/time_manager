import { NotFoundException } from '@nestjs/common';

type AsyncMethod<Arguments extends unknown[], Result> = (
  ...args: Arguments
) => Promise<Result | null>;

/** Transforme le résultat null d'une méthode asynchrone en erreur HTTP 404. */
export function NotFoundIfNull() {
  return function <Arguments extends unknown[], Result>(
    _target: object,
    _propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<AsyncMethod<Arguments, Result>>,
  ): void {
    const originalMethod = descriptor.value;
    if (!originalMethod) {
      throw new Error('NotFoundIfNull must decorate an async method');
    }

    descriptor.value = async function (this: unknown, ...args: Arguments) {
      const result = await originalMethod.apply(this, args);
      if (result === null) throw new NotFoundException('not_found');
      return result;
    };
  };
}
