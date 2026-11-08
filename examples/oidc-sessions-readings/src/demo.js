import { Login } from './login.js';
import { providerFixture } from './provider-fixture.js';
import { Sessions, origin } from './sessions.js';

const provider = await providerFixture();
const sessions = new Sessions();
const login = new Login(sessions, provider.publicKey);
const anonymous = sessions.create();
const transaction = login.begin(anonymous.id, { maxAge: 300 });
// Simulated post-exchange ID Token: no real provider authentication or OAuth flow.
const authenticated = await login.complete({
  browserSessionId: anonymous.id,
  state: transaction.state,
  idToken: await provider.sign(transaction.nonce),
  userInfo: { sub: 'provider-user-1', name: 'Demo' },
});
const record = sessions.authenticated(authenticated.id);
sessions.mutation(authenticated.id, { requestOrigin: origin, csrf: record.csrf });
console.log('Validated login and rotated session; CSRF-protected mutation accepted');
sessions.destroy(authenticated.id);
try {
  sessions.authenticated(authenticated.id);
} catch {
  console.log('Copied predecessor and logged-out credential cannot restore authentication');
}
// No tokens, IDs, nonces, cookies or CSRF proofs are printed.
