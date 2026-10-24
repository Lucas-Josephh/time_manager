import { buildUserName } from '../user/user-name';
import { validateUserProfile } from '../auth/validate-user-profile';
import {
  PASSWORD_REQUIREMENTS_REGEX,
  PASSWORD_REQUIREMENTS_CODE,
} from '../common/decorator/password.decorator';
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { i18n, locales } from '@better-auth/i18n';
import {
  createAuthMiddleware,
  APIError,
  getSessionFromCtx,
} from 'better-auth/api';

type AuthOptions = BetterAuthOptions & {
  plugins: [ReturnType<typeof i18n>];
  user: {
    additionalFields: {
      firstname: { type: 'string'; required: true };
      lastname: {
        type: 'string';
        required: true;
      };
      phone: { type: 'string'; required: false };
      mustChangePassword: {
        type: 'boolean';
        defaultValue: true;
        input: boolean;
      };
      teamId: { type: 'string'; required: false; input: boolean };
      organizationId: { type: 'string'; required: false; input: boolean };
      isAdmin: {
        type: 'boolean';
        defaultValue: false;
        input: boolean;
      };
    };
  };
};

/**
 * Creates and configures the Better Auth instance with the provided Prisma service and configuration.
 *
 * @param prisma - The Prisma service instance for database interactions.
 * @param config - The configuration service instance for accessing environment variables.
 * @param param2 - An object containing optional parameters for configuring the authentication instance.
 * @param param2.provisionUsers - Whether to allow user provisioning (default: false).
 */
export function createAuth(
  prisma: PrismaService,
  config: ConfigService,
  { provisionUsers = false }: { provisionUsers?: boolean } = {},
): ReturnType<typeof betterAuth<AuthOptions>> {
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

  const options: AuthOptions = {
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
      disableSignUp: !provisionUsers,
      ...(provisionUsers ? { autoSignIn: false } : {}),
      onPasswordReset: async ({ user }) => {
        await prisma.user.update({
          where: { id: user.id },
          data: { mustChangePassword: false },
        });
      },
    },

    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === '/update-user') {
          const body = await validateUserProfile(ctx.body);
          if (body.firstname !== undefined || body.lastname !== undefined) {
            const session = await getSessionFromCtx(ctx);
            if (!session)
              throw new APIError('UNAUTHORIZED', {
                code: 'UNAUTHORIZED',
                message: 'unauthorized',
              });
            const user = await ctx.context.internalAdapter.findUserById(
              session.user.id,
            );
            if (!user)
              throw new APIError('UNAUTHORIZED', {
                code: 'UNAUTHORIZED',
                message: 'unauthorized',
              });
            const currentProfile = user as typeof user & {
              firstname: string;
              lastname: string;
            };
            const name = buildUserName(
              body.firstname ?? currentProfile.firstname,
              body.lastname ?? currentProfile.lastname,
            );
            return { context: { body: { ...body, name } } };
          }
          return { context: { body } };
        }

        // Provisioning keeps Better Auth's required name in sync with the source fields.
        if (
          ctx.path === '/sign-up/email' &&
          typeof ctx.body?.firstname === 'string' &&
          typeof ctx.body?.lastname === 'string'
        ) {
          ctx.body.name = buildUserName(ctx.body.firstname, ctx.body.lastname);
        }

        if (
          !['/sign-up/email', '/reset-password', '/change-password'].includes(
            ctx.path,
          )
        ) {
          return;
        }

        const password =
          ctx.path === '/sign-up/email'
            ? ctx.body?.password
            : ctx.body?.newPassword;

        if (
          ctx.path === '/change-password' &&
          password === ctx.body?.currentPassword
        ) {
          throw new APIError('BAD_REQUEST', {
            code: 'PASSWORD_MUST_DIFFER',
            message: 'PASSWORD_MUST_DIFFER',
          });
        }

        if (
          typeof password !== 'string' ||
          !PASSWORD_REQUIREMENTS_REGEX.test(password)
        ) {
          throw new APIError('BAD_REQUEST', {
            code: PASSWORD_REQUIREMENTS_CODE,
            message: PASSWORD_REQUIREMENTS_CODE,
          });
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (
          ctx.path !== '/change-password' ||
          !ctx.context.session ||
          ctx.context.returned instanceof APIError
        )
          return;
        await ctx.context.internalAdapter.updateUser(
          ctx.context.session.user.id,
          {
            mustChangePassword: false,
          },
        );
      }),
    },
    user: {
      additionalFields: {
        firstname: { type: 'string', required: true },
        lastname: {
          type: 'string',
          required: true,
        },
        phone: {
          type: 'string',
          required: false,
        },
        // Only the server-side provisioning instance accepts these fields.
        teamId: { type: 'string', required: false, input: provisionUsers },
        organizationId: {
          type: 'string',
          required: false,
          input: provisionUsers,
        },
        mustChangePassword: {
          type: 'boolean',
          defaultValue: true,
          input: provisionUsers,
        },
        isAdmin: {
          type: 'boolean',
          defaultValue: false,
          input: provisionUsers,
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
