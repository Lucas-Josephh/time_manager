import { inferAdditionalFields } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

// Same-origin requests go through Next.js in development and Nginx in Docker.
export const authClient = createAuthClient({
  basePath: '/api/auth',
  plugins: [
    inferAdditionalFields({
      user: {
        firstname: { type: 'string', required: true },
        lastname: { type: 'string', required: true },
      },
    }),
  ],
});
