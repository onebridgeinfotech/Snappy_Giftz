import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
console.log('--- Checking URLs and OAuth in .env ---');
for (const line of env.split('\n')) {
  if (
    line.startsWith('NEXT_PUBLIC_APP_URL=') ||
    line.startsWith('NEXTAUTH_URL=') ||
    line.startsWith('GOOGLE_REDIRECT_URI=') ||
    line.startsWith('GOOGLE_OAUTH_REDIRECT_URI=') ||
    line.startsWith('GOOGLE_DRIVE_REDIRECT_URI=')
  ) {
    console.log(line.trim());
  }
}
