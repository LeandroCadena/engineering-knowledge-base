import { signingKey, readOrder, issuer } from './tokens.js';
import { Transactions, clientId } from './transactions.js';
import { AuthorizationFixture } from './authorization-fixture.js';

const provider = new AuthorizationFixture(await signingKey('demo-key'));
const client = new Transactions();
const authorization = client.begin('fixture-browser-session');
const callback = provider.authorize(authorization); // Simulated user approval, no real login.
const tokens = await provider.redeem(client.consume('fixture-browser-session', callback));
const context = await provider.resourceContext(tokens.access_token);
console.log(
  'Read own order:',
  readOrder(context, {
    id: 'ord_000001',
    ownerIssuer: issuer,
    ownerSubject: 'user-123',
    quantity: 2,
  }).status,
);
const rotated = await provider.refresh({
  grant_type: 'refresh_token',
  client_id: clientId,
  refresh_token: tokens.refresh_token,
});
console.log('Refresh replaced:', rotated.refresh_token !== tokens.refresh_token);
provider.revoke(rotated.refresh_token);
try {
  await provider.resourceContext(rotated.access_token);
} catch {
  console.log('Revoked family rejected by state-aware resource server');
}
// Never print the code, verifier, signing key or tokens.
