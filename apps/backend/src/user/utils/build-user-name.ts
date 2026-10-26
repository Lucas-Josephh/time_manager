/**
 * Build the display name from the trimmed first and last names.
 *
 * @param firstname - First name, possibly surrounded by whitespace.
 * @param lastname - Last name, possibly surrounded by whitespace.
 */
export function buildUserName(firstname: string, lastname: string): string {
  return `${firstname.trim()} ${lastname.trim()}`.trim();
}
