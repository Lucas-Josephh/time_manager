import { Transform } from 'class-transformer';

/**
 * Lowercases a string value if it is a string, otherwise returns the value unchanged.
 *
 * @param value
 */
function lowercaseString(value: unknown): unknown {
  return typeof value === 'string' ? value.toLowerCase() : value;
}

/**
 * A property decorator that lowercases string values.
 * If `each` is true, it lowercases each string in an array.
 *
 * @param options
 * @constructor
 */
export function Lowercase(options: { each?: boolean } = {}): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) => {
    if (options.each) {
      return Array.isArray(value) ? value.map(lowercaseString) : value;
    }
    return lowercaseString(value);
  });
}
