/**
 * Validates if a given SFDX auth URL is properly formatted
 * @param sfdxAuthUrl The SFDX auth URL to validate
 * @returns true if valid, false otherwise
 */
export function isValidSfdxAuthUrl(sfdxAuthUrl: string): boolean {
  if (!sfdxAuthUrl) {
    return false;
  }

  // Check for refresh token only format: force://<refreshToken>@<instanceUrl>
  if (sfdxAuthUrl.match(/force:\/\/(?<refreshToken>[a-zA-Z0-9._]+)@.+/)) {
    return true;
  }

  // Check for full OAuth format: force://<clientId>:<clientSecret>:<refreshToken>@<instanceUrl>
  const match = sfdxAuthUrl.match(
    /force:\/\/(?<clientId>[a-zA-Z0-9._=]+):(?<clientSecret>[a-zA-Z0-9]*):(?<refreshToken>[a-zA-Z0-9._=]+)@.+/
  );

  if (match !== null) {
    // Ensure refresh token is not 'undefined' string
    if (match.groups?.refreshToken === 'undefined') {
      return false;
    }
    return true;
  }

  return false;
}