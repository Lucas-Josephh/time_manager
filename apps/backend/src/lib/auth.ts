import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { getAuthConfig } from '../auth/auth-config';
import { createAuthHooks } from '../auth/auth-hooks';
import { betterAuthAdditionalFields } from '../auth/auth-user-fields';
import { betterAuthTranslations } from '../auth/auth-translations';

/**
 * The auth options type is a combination of the BetterAuthOptions and
 * our custom fields for plugins and user additional fields.
 */
type AuthOptions = BetterAuthOptions & {
  plugins: [ReturnType<typeof betterAuthTranslations>];
  user: { additionalFields: ReturnType<typeof betterAuthAdditionalFields> };
};

/**
 * Creates the BetterAuth instance with the provided PrismaService and ConfigService.
 *
 * @param prisma
 * @param config
 * @param param2
 * @param param2.provisionUsers
 */
export function createAuth(
  prisma: PrismaService,
  config: ConfigService,
  { provisionUsers = false }: { provisionUsers?: boolean } = {},
): ReturnType<typeof betterAuth<AuthOptions>> {

  const { baseURL, frontend, secret, socialProviders } = getAuthConfig(config);

  const options: AuthOptions = {
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    secret,
    baseURL,
    basePath: '/api/auth',
    trustedOrigins: [frontend],
    socialProviders,

    // The account configuration defines how account linking works, including whether it is enabled and which providers are trusted for linking.
    account: {
      accountLinking: {
        enabled: true,

        // Allows to link a Microsoft account to an existing local account without requiring the user to log in first.
        disableImplicitLinking: false,

        // Administrators provision local users; Microsoft authenticates their matching email.
        requireLocalEmailVerified: false,

        // If true, allows linking multiple social accounts to the same local account even if they have different emails.
        allowDifferentEmails: false,

        trustedProviders: ['microsoft'],
      },
    },

    // The emailAndPassword configuration defines how email/password authentication works, including whether sign-up is allowed and how password resets are handled.
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

    // The hooks configuration allows for custom logic to be executed at various points in the auth flow.
    hooks: createAuthHooks(),

    // The user configuration defines additional fields for the user model, which can be used for storing extra information about users.
    user: {
      additionalFields: betterAuthAdditionalFields(provisionUsers),
    },

    // The session configuration defines how long a session lasts and how often it is updated.
    session: {
      expiresIn: 7 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
      cookieCache: { enabled: false },
    },

    // The advanced configuration defines security-related settings for the auth system.
    advanced: {
      disableOriginCheck: false,
      disableCSRFCheck: false,
      useSecureCookies: baseURL.startsWith('https:'),
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
    },

    // Defines rate limiting settings for the auth system to prevent abuse.
    rateLimit: { enabled: true },

    // The plugins array allows for extending the auth system with additional functionality, such as translations.
    plugins: [betterAuthTranslations()],
  };

  return betterAuth(options);
}
