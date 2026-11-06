import fs from 'fs';

async function testGoogleAuth() {
  console.log('--- Testing /api/auth/google Entrypoint ---');
  const res = await fetch('http://localhost:3000/api/auth/google', {
    headers: { 'Accept': 'application/json' }
  });
  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Response:', data);

  if (data.url) {
    const url = new URL(data.url);
    console.log('Google Auth URL components:');
    console.log('  client_id:', url.searchParams.get('client_id')?.slice(0, 15) + '...');
    console.log('  redirect_uri:', url.searchParams.get('redirect_uri'));
    console.log('  scope:', url.searchParams.get('scope'));
    console.log('  response_type:', url.searchParams.get('response_type'));
  }
}

testGoogleAuth().catch(console.error);

