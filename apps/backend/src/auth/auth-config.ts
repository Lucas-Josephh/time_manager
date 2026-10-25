import { ConfigService } from '@nestjs/config';
import type { BetterAuthOptions } from 'better-auth';

/**
 *  Validate auth environment variables before creating the instance.
 */
export function getAuthConfig(config: ConfigService) {
  const baseURL = config.getOrThrow<string>('BETTER_AUTH_URL');
  const frontend = config.getOrThrow<string>('FRONTEND_URL');
  const secret = config.getOrThrow<string>('BETTER_AUTH_SECRET');

  if (secret.length < 32)
    throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters');

  new URL(baseURL);
  if (new URL(frontend).origin !== frontend)
    throw new Error('FRONTEND_URL must be an origin');

  const clientId = config.get<string>('MICROSOFT_CLIENT_ID')?.trim();
  const clientSecret = config.get<string>('MICROSOFT_CLIENT_SECRET')?.trim();
  const tenantId = config.get<string>('MICROSOFT_TENANT_ID')?.trim();

  const microsoftConfigured = Boolean(clientId || clientSecret || tenantId);

  if (microsoftConfigured && (!clientId || !clientSecret || !tenantId))
    throw new Error(
      'Microsoft authentication requires client ID, client secret and tenant ID',
    );

  if (
    tenantId &&
    ['common', 'organizations', 'consumers'].includes(tenantId.toLowerCase())
  )
    throw new Error(
      'Microsoft authentication requires a specific organization tenant',
    );

  const socialProviders: NonNullable<BetterAuthOptions['socialProviders']> =
    microsoftConfigured
      ? {
          microsoft: {
            clientId: clientId!,
            clientSecret: clientSecret!,
            tenantId,
            disableSignUp: true,
            disableProfilePhoto: true,
            prompt: 'select_account',
          },
        }
      : {};

  return { baseURL, frontend, secret, socialProviders };
}
