import { i18n, locales } from '@better-auth/i18n';

/**
 * Creates the BetterAuth translations with the provided locales and default locale.
 */
export function betterAuthTranslations(): ReturnType<typeof i18n> {
  return i18n({
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
  });
}
