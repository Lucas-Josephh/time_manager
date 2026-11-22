import { AsyncLocalStorage } from 'node:async_hooks';

// Each request has its own context, including concurrent requests.
export const uniqueValidationRequest = new AsyncLocalStorage<{
  method: string;
  params: Record<string, unknown>;
}>();
