import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { i18n, locales } from '@better-auth/i18n';
import { createAuthMiddleware, APIError } from 'better-auth/api';

export function createAuth(
  prisma: PrismaService,
  config: ConfigService,
): ReturnType<
  typeof betterAuth<BetterAuthOptions & { plugins: [ReturnType<typeof i18n>] }>
> {
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

  const options: BetterAuthOptions & {
    plugins: [ReturnType<typeof i18n>];
  } = {
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    secret,
    baseURL,
    basePath: '/api/auth',
    trustedOrigins: [frontend],
    socialProviders: microsoftConfigured
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
      : {},
    account: {
      accountLinking: {
        enabled: true,

        // Allows to link a Microsoft account to an existing local account without requiring the user to log in first.
        disableImplicitLinking: false,

        // Administrators provision local users; Microsoft authenticates their matching email.
        requireLocalEmailVerified: false,
        trustedProviders: ['microsoft'],
        allowDifferentEmails: false,
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },

    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== '/sign-up/email') {
          return;
        }

        const password = ctx.body?.password;

        if (
          typeof password !== 'string' ||
          !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/.test(password)
        ) {
          throw new APIError('BAD_REQUEST', {
            message:
              'Le mot de passe doit contenir une majuscule, une minuscule, un chiffre et un caractère spécial.',
          });
        }
      }),
    },
    user: {
      fields: { name: 'firstname' },
      additionalFields: {
        lastname: {
          type: 'string',
          required: true,
        },
        phone: {
          type: 'string',
          required: false,
        },
        teamId: {
          type: 'string',
          required: false,
          input: false,
        },
        isAdmin: {
          type: 'boolean',
          defaultValue: false,
          input: false,
        },
      },
    },
    session: {
      expiresIn: 7 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
      cookieCache: { enabled: false },
    },
    advanced: {
      disableOriginCheck: false,
      disableCSRFCheck: false,
      useSecureCookies: baseURL.startsWith('https:'),
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
    },
    rateLimit: { enabled: true },
    plugins: [
      i18n({
        defaultLocale: 'fr',
        translations: {
          en: {
            ...locales.en,
            PASSWORD_REQUIREMENTS_NOT_MET:
              'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character.',
          },
          fr: {
            ...locales.fr,
            PASSWORD_REQUIREMENTS_NOT_MET:
              'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial.',
          },
        },
      }),
    ],
  };

  return betterAuth(options);
}
