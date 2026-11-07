/** User-facing messages for Google Drive OAuth redirect query params. */
export function describeGoogleDriveOAuthError(raw: string): string {
  const code = decodeURIComponent(raw).trim();
  const lower = code.toLowerCase();

  if (lower === 'invalid_request' || lower.includes('invalid_request')) {
    return (
      'Google blocked the connection (Error 400: invalid_request). In Google Cloud Console → ' +
      'APIs & Services → Credentials → your OAuth client “SNAPPY GIFTZ PRODUCTION”, add this Authorized redirect URI: ' +
      'https://snappygiftz.com/api/integrations/google-drive/callback (and the same URI with www if you use it). ' +
      'If the app is in Testing mode, add the signing-in Google account under OAuth consent screen → Test users.'
    );
  }

  if (lower === 'access_denied') {
    return (
      'Google sign-in was cancelled or denied. If the app is still in Testing mode, the Google account you choose must be ' +
      'listed under OAuth consent screen → Test users. For production, complete Google app verification or publish the app.'
    );
  }

  if (lower.includes("doesn't comply") || lower.includes('oauth 2.0 policy')) {
    return (
      'Google has restricted this app until OAuth verification is complete. Use Test users while in Development, or submit ' +
      'the app for verification in Google Cloud Console. Redirect URI must be: https://snappygiftz.com/api/integrations/google-drive/callback'
    );
  }

  return code;
}
