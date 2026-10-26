/**
 * Return the additional fields required for user provisioning in BetterAuth.
 *
 * @param provisionUsers
 */
export function betterAuthAdditionalFields(provisionUsers: boolean) {
  return {
    firstname: { type: 'string', required: true },
    lastname: {
      type: 'string',
      required: true,
    },
    job: { type: 'string', required: false },
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
  } as const;
}
