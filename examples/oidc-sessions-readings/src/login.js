import {
  Accounts,
  bindUserInfo,
  LoginTransactions,
  nowSeconds,
  validateIdentity,
} from './identity.js';

// Called only after a trusted OAuth/OIDC library has validated the callback and code exchange.
export class Login {
  constructor(sessions, keys, now = nowSeconds) {
    this.sessions = sessions;
    this.keys = keys;
    this.now = now;
    this.transactions = new LoginTransactions(now);
    this.accounts = new Accounts();
  }
  begin(browserSessionId, options) {
    this.sessions.inspect(browserSessionId);
    return this.transactions.begin(browserSessionId, options);
  }
  async complete({ browserSessionId, state, idToken, userInfo }) {
    this.sessions.inspect(browserSessionId);
    const pending = this.transactions.consume(browserSessionId, state);
    const identity = await validateIdentity(idToken, this.keys, pending, this.now());
    if (userInfo !== undefined) bindUserInfo(identity, userInfo);
    const accountId = this.accounts.resolve(identity);
    // Rotation rechecks the predecessor after await; logout wins over a stale completion.
    return this.sessions.rotate(browserSessionId, accountId, identity);
  }
}
