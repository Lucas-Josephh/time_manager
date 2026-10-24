/** The display name is derived from the two independent name fields. */
export function buildUserName(firstname: string, lastname: string): string {
  return `${firstname.trim()} ${lastname.trim()}`.trim();
}
