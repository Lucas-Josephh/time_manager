/** Error keys match input names, including bracket notation for nested fields. */
export const fieldErrorsSchema = {
  type: 'object' as const,
  additionalProperties: {
    type: 'object' as const,
    required: ['messages'],
    properties: {
      messages: { type: 'array' as const, items: { type: 'string' as const } },
    },
  },
  example: { 'userIds[2]': { messages: ['outside_management_scope'] } },
};
