import { Transform } from 'class-transformer';

/**
 * Trims a string value if it is a string, otherwise returns the value unchanged.
 *
 * @param value
 */
function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/**
 * A property decorator that trims string values.
 * If `each` is true, it trims each string in an array.
 *
 * @param options
 * @constructor
 */
export function Trim(options: { each?: boolean } = {}): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) => {
    if (options.each) {
      return Array.isArray(value) ? value.map(trimString) : value;
    }
    return trimString(value);
  });
}
