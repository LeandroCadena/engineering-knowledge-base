import { generateKeyPair, SignJWT } from 'jose';
import { clientId, issuer, nowSeconds } from './identity.js';

export async function providerFixture(now = nowSeconds) {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  return {
    publicKey,
    sign(nonce, overrides = {}, header = {}) {
      const at = now();
      return new SignJWT({
        iss: issuer,
        aud: clientId,
        sub: 'provider-user-1',
        iat: at,
        exp: at + 300,
        auth_time: at,
        nonce,
        ...overrides,
      })
        .setProtectedHeader({ alg: 'RS256', typ: 'JWT', ...header })
        .sign(privateKey);
    },
  };
}
