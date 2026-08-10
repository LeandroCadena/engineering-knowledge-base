---
title: API Keys Deep Dive
description: Understand how API Keys are structured, validated, exposed, restricted, attributed, and managed throughout their lifecycle.
icon: api-keys.png
order: 2
updatedAt: 2026-08-10
---

# API Key Structure

An API Key is credential material issued by a provider and associated with a record the provider controls.

Keys may be completely opaque or follow a provider-defined format. Their structure is not standardized, so clients must treat the format as part of the issuing system's contract rather than assume that every key contains the same components.

![API Key Anatomy](/docs/api-keys/api-keys-anatomy.png)

Secret key material should be generated from cryptographically secure randomness rather than predictable identifiers, timestamps, usernames, or application data:

~~~ts
import { randomBytes } from 'node:crypto';

const secret = randomBytes(32).toString('base64url');
~~~

A provider can combine generated secret material with its own external format:

~~~ts
const apiKey = `sk_live_${secret}`;
~~~

The complete credential may be displayed only when it is created if the provider stores a non-recoverable verification representation rather than the original secret.

This allows subsequent verification without providing a mechanism for retrieving the original credential.

---

# API Key Validation

Receiving an API Key is not sufficient to trust it. The provider must resolve the presented credential to a known key record and verify that the secret material corresponds to that record.

A key record can separate information required for lookup from the representation used to verify the secret:

~~~ts
interface ApiKeyRecord {
  id: string;
  keyHash: string;
  status: 'active' | 'revoked';
  expiresAt: Date | null;
}
~~~

When a key format contains a non-secret identifier, that identifier can locate the candidate record without using the complete secret as a database lookup value:

~~~ts
const record = await apiKeys.findById(keyId);

if (!record) {
  throw new Error('Invalid API key');
}

const valid = await verifyApiKey(
  presentedSecret,
  record.keyHash,
);

if (!valid) {
  throw new Error('Invalid API key');
}
~~~

The stored verification representation can be derived when the credential is created:

~~~ts
const keyHash = await hashApiKey(secret);

await apiKeys.create({
  id: keyId,
  keyHash,
  status: 'active',
  expiresAt: null,
});
~~~

The exact verification mechanism depends on the key design. A provider that must recover the original key has different storage requirements from one that only needs to determine whether a presented credential is valid.

Operational systems can use a non-secret identifier or fingerprint when referring to a credential in logs, dashboards, or audit records instead of exposing the complete key.

---

# API Key Exposure

Possession of a secret API Key can be sufficient to exercise the privileges associated with it. Its confidentiality is therefore part of the credential's security boundary.

Secret keys belong in environments where their value can remain confidential:

~~~ts
const apiKey = process.env.PAYMENTS_API_KEY;

if (!apiKey) {
  throw new Error('PAYMENTS_API_KEY is not configured');
}
~~~

Moving a secret outside source code does not automatically encrypt or protect it. The runtime, deployment system, logs, debugging tools, and operators with access to the environment can still affect its exposure.

Secret credentials should also be protected while crossing the network by transport security such as HTTPS.

Not every API Key is designed to remain confidential. Providers can issue **publishable keys** for client environments where the value is expected to be observable, while enforcing security through the limited capabilities and restrictions associated with that key.

A **restricted key** reduces what possession of the credential permits. Whether such a key may safely appear in a particular client environment still depends on the provider's security model and configured restrictions.

The exposure model is therefore part of the credential contract: a key intended only for trusted backend systems should not be treated as interchangeable with one explicitly designed for public clients.

---

# API Key Restrictions

A valid API Key can resolve to policy that limits the contexts and operations in which the credential is accepted.

![API Key Restrictions](/docs/api-keys/api-keys-restrictions.png)

Credential verification and policy authorization are separate decisions. Successfully verifying the key establishes which key record is being presented; the associated policy determines whether that record permits the requested operation.

For example, an endpoint can require a permission associated with the resolved key:

~~~ts
if (!apiKey.scopes.includes('orders:write')) {
  throw new Error('Insufficient scope');
}
~~~

Restrictions can also be evaluated against request context:

~~~ts
if (!apiKey.allowedEnvironments.includes(environment)) {
  throw new Error('API key is not allowed in this environment');
}
~~~

Policy should be controlled by the provider-side key record rather than trusted merely because a client supplied additional claims alongside its credential.

This allows permissions and restrictions to change without issuing a differently encoded credential when the provider's key model supports server-side policy updates.

---

# API Key Attribution

Resolving an API Key gives the provider a stable identifier that can associate requests with a client, application, project, integration, or other provider-defined context.

That identifier can become the attribution key for usage accounting:

~~~ts
const usage = await usageStore.increment(apiKey.id);
~~~

A **rate limit** constrains how quickly requests may be made, while a **quota** constrains consumption across a broader allowance or period.

For example:

~~~text
Rate limit: 100 requests / minute
Quota:      100,000 requests / month
~~~

The resolved key can select the limits associated with its client or plan:

~~~ts
const usage = await usageStore.increment(apiKey.id);

if (usage.monthly > apiKey.monthlyQuota) {
  throw new Error('Monthly quota exceeded');
}
~~~

The same attribution can support usage analytics and billing without requiring the API Key itself to encode those values.

Changes to a client's plan or allowance can therefore modify provider-side configuration while preserving the credential when the surrounding system permits it.

---

# API Key Lifecycle

An issued API Key remains usable only while its provider-side state allows it.

Expiration places a time boundary on that state:

~~~ts
if (
  apiKey.expiresAt &&
  apiKey.expiresAt.getTime() <= Date.now()
) {
  throw new Error('API key expired');
}
~~~

**Revocation** explicitly invalidates a credential independently of its original expiration:

~~~ts
await apiKeys.update(apiKey.id, {
  status: 'revoked',
});
~~~

A revoked credential should no longer be accepted even if the presented secret is otherwise correct.

**Rotation** replaces credential material while allowing clients to migrate to a new key. Systems that support multiple credentials for the same client can temporarily keep both old and new keys active:

~~~ts
const newKey = await apiKeys.createForClient(clientId);

await deliverNewKey(newKey);
~~~

After clients have migrated, the previous credential can be revoked:

~~~ts
await apiKeys.update(previousKeyId, {
  status: 'revoked',
});
~~~

This overlap separates credential replacement from immediate invalidation and allows rotation without requiring every consumer to switch at exactly the same moment.

If a key is suspected to be compromised, revocation can terminate its validity and a replacement credential can establish new secret material.

Deletion is distinct from revocation. Retaining a non-secret record of a revoked key can preserve audit and usage history even though the credential itself can no longer authorize requests.

---

# Putting Everything Together

An API Key converts a presented credential into provider-controlled context that can be evaluated before the requested operation is executed.

![API Key Putting Everything Together](/docs/api-keys/api-keys-putting-everything-together.png)

The credential remains intentionally small while its mutable state, restrictions, lifecycle information, and usage context can remain under provider control.