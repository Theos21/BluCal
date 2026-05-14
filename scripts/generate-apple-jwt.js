// Generates a 180-day JWT for Supabase's Sign in with Apple provider config.
//
// Inputs come from the Apple Developer Portal:
//   TEAM_ID            — "Membership" page (10-char alphanumeric)
//   KEY_ID             — Keys > the Sign in with Apple key you created
//   CLIENT_ID          — the Services ID identifier you registered (NOT the
//                        app bundle id; this is the one used as the Apple
//                        OAuth client_id)
//   PRIVATE_KEY_PATH   — local path to the AuthKey_<KEY_ID>.p8 you downloaded
//
// Paste the JWT into Supabase: Authentication > Providers > Apple >
// "Secret Key (for OAuth)".
//
// Re-run before the 180-day expiry to mint a fresh JWT.

const crypto = require('crypto');
const fs = require('fs');

const TEAM_ID = '9FXRBZ9H3L';
const KEY_ID = 'Z6KVFU2DSC';
const CLIENT_ID = 'com.blucal.signin';
const PRIVATE_KEY_PATH = 'C:\\Users\\samer\\Downloads\\AuthKey_Z6KVFU2DSC.p8';

const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');

const now = Math.floor(Date.now() / 1000);

const header = Buffer.from(
  JSON.stringify({
    alg: 'ES256',
    kid: KEY_ID,
    typ: 'JWT',
  }),
).toString('base64url');

const payload = Buffer.from(
  JSON.stringify({
    iss: TEAM_ID,
    iat: now,
    exp: now + 86400 * 180, // 180 days
    aud: 'https://appleid.apple.com',
    sub: CLIENT_ID,
  }),
).toString('base64url');

const signingInput = `${header}.${payload}`;

const sign = crypto.createSign('SHA256');
sign.update(signingInput);
sign.end();

const signature = sign
  .sign({
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  })
  .toString('base64url');

const jwt = `${header}.${payload}.${signature}`;

// Write to a file so the user can copy without terminal line-wrap artifacts.
// File is gitignored via the scripts/apple-jwt.txt pattern.
const OUT_PATH = 'scripts/apple-jwt.txt';
fs.writeFileSync(OUT_PATH, jwt);

console.log('Apple Sign In JWT:');
console.log(jwt);
console.log('');
console.log(`Length: ${jwt.length} chars`);
console.log(`Segments: ${jwt.split('.').length} (should be 3)`);
console.log(`Written to: ${OUT_PATH}`);
