import type { FieldErrors } from './format-validation-errors';

/** Collect input errors without coupling validation rules to HTTP exceptions. */
export class FieldErrorsBuilder {
  private readonly fields = new Map<string, Set<string>>();

  static path(field: string, ...segments: (string | number)[]): string {
    return segments.reduce<string>(
      (path, segment) => (path ? `${path}[${segment}]` : String(segment)),
      field,
    );
  }

  add(field: string, ...messages: string[]): this {
    if (!messages.length) return this;
    const codes = this.fields.get(field) ?? new Set<string>();
    for (const message of messages) codes.add(message);
    this.fields.set(field, codes);
    return this;
  }

  at(field: string, ...segments: (string | number)[]): {
    add: (...messages: string[]) => FieldErrorsBuilder;
  } {
    const path = FieldErrorsBuilder.path(field, ...segments);
    return { add: (...messages: string[]) => this.add(path, ...messages) };
  }

  merge(errors: FieldErrors): this {
    for (const [field, { messages }] of Object.entries(errors)) {
      this.add(field, ...messages);
    }
    return this;
  }

  hasErrors(): boolean {
    return this.fields.size > 0;
  }

  toObject(): FieldErrors {
    return Object.fromEntries(
      [...this.fields].map(([field, messages]) => [
        field,
        { messages: [...messages] },
      ]),
    );
  }
}
