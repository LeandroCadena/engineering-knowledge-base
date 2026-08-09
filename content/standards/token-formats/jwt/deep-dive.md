---
title: JWT Deep Dive
description: Understand how JSON Web Tokens are structured, signed, verified, distributed, validated, and secured in real systems.
icon: jwt.png
order: 2
updatedAt: 2026-07-05
---

# JWT Deep Dive

# JWT Structure and Encoding

A JWT uses a compact serialization designed to represent structured data as a string that can travel easily between systems.

The serialized token contains three sections separated by periods:

```text
xxxxx.yyyyy.zzzzz
```

These sections represent the **Header**, **Payload**, and **Signature**.

The Header and Payload begin as JSON objects. Their JSON representation is converted to bytes and encoded using **Base64URL**, producing strings that are safe to include in the compact token format.

Base64URL is an encoding mechanism, not encryption. Anyone who obtains a JWT can decode these sections without possessing a cryptographic key.

The encoded Header and encoded Payload are joined by a period:

```text
<encoded-header>.<encoded-payload>
```

This exact value forms the **Signing Input** used by the cryptographic signing process.

Because the signature is calculated from the encoded Header and Payload, their serialized representation is part of what the signature protects. Changing either section changes the Signing Input and causes verification of the original signature to fail.

A token can be separated into its serialized components directly:

```ts
const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
```

The first two sections can then be decoded independently:

```ts
const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));

const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
```

This only **decodes** the token. It does not establish that the contents are authentic or that the JWT is valid.

Applications should normally rely on a JWT library for parsing and cryptographic processing rather than implementing the serialization or decoding mechanisms themselves.

---

# Claims and Token Metadata

The **Header** contains metadata used to process the token, while the **Payload** contains the **Claim Set** communicated by the issuer.

JWT defines standardized claims with common semantics while also allowing applications to introduce claims for their own domain.

Custom claims can carry application-specific information:

```json
{
  "role": "admin",
  "permissions": ["orders:read", "orders:write"],
  "tenantId": "tenant-42"
}
```

![JWT Claims and Header Parameters](/docs/jwt/jwt-claims-and-header-parameters.png)

Header parameters and claims form part of the contract between issuer and recipient. A recipient should only make decisions from values whose meaning and validation requirements it understands.

JWT libraries expose APIs for setting standardized claims while allowing application-specific claims to be included in the Payload:

```ts
const token = await new SignJWT({
  role: 'admin',
  permissions: ['orders:read', 'orders:write'],
})
  .setProtectedHeader({
    alg: 'RS256',
    kid: 'key-2026-01',
  })
  .setIssuer('https://auth.example.com')
  .setSubject('user-123')
  .setAudience('orders-api')
  .setIssuedAt()
  .setExpirationTime('15m')
  .sign(privateKey);
```

---

# Signing and Verification

A JWT signature cryptographically binds the Signing Input to the issuer's signing key.

Signing applies the selected cryptographic algorithm using that key, producing the signature stored as the third section of the token.

Verification applies the corresponding cryptographic operation using the appropriate verification key.

If the Header or Payload changes after the token is signed, the Signing Input changes and the existing signature no longer verifies.

This provides **integrity**: modifications to the protected content can be detected.

It can also establish **authenticity relative to a trusted key**. A successful verification proves that the signature was produced with the key required by the selected cryptographic scheme, but the application must already have a trusted way to associate that key with the expected issuer.

Signing a JWT with a library applies this mechanism without requiring the application to construct the signature manually:

```ts
const token = await new SignJWT({
  role: 'admin',
})
  .setProtectedHeader({
    alg: 'RS256',
    kid: 'key-2026-01',
  })
  .setIssuer('https://auth.example.com')
  .setAudience('orders-api')
  .setExpirationTime('15m')
  .sign(privateKey);
```

The verifier uses the corresponding verification key:

```ts
const { payload, protectedHeader } = await jwtVerify(token, publicKey);
```

Successful signature verification establishes cryptographic integrity, but does not determine whether the JWT is acceptable to the application.

---

# Algorithms and Trust Models

JWT signing can use different cryptographic families, and the choice of algorithm changes the trust relationship between the issuer and the systems that verify its tokens.

The main distinction is between **symmetric** and **asymmetric** signing.

With symmetric signing, the same secret is used to create and verify signatures:

```ts
const token = await new SignJWT({
  role: 'admin',
})
  .setProtectedHeader({
    alg: 'HS256',
  })
  .sign(secret);
```

Any system capable of verifying the token also possesses the secret required to create valid signatures. Verification authority and issuance authority therefore cannot be separated cryptographically.

With asymmetric signing, the issuer signs tokens with a **private key**, while verifiers use the corresponding **public key**:

```ts
const token = await new SignJWT({
  role: 'admin',
})
  .setProtectedHeader({
    alg: 'RS256',
    kid: 'key-2026-01',
  })
  .sign(privateKey);
```

A verifier can validate the signature without receiving the private key:

```ts
const { payload } = await jwtVerify(token, publicKey);
```

This separates the ability to **issue tokens** from the ability to **verify tokens**. The private key can remain restricted to the issuer while public keys are distributed to systems that need to validate JWTs.

![JWT Signing Algorithms](/docs/jwt/jwt-signing-algorithms.png)

The algorithm declared by a token should not determine the verifier's security policy. Acceptable algorithms must be configured explicitly:

```ts
const { payload } = await jwtVerify(token, publicKey, {
  algorithms: ['RS256'],
});
```

Algorithm selection is controlled by the verifier rather than delegated to the token itself.

---

# Keys and Key Distribution

Asymmetric JWT signing allows the issuer to keep its private key secret while distributing public keys to systems that need to verify tokens.

When an issuer maintains multiple signing keys, the JWT Header can include a **Key ID (`kid`)** identifying which key was used to create the signature.

```json
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "key-2026-01"
}
```

The `kid` does not contain the verification key and does not make that key trustworthy. It identifies which key the verifier should select from a trusted set of candidates.

Public keys can be represented using **JSON Web Key (JWK)**, a JSON format for cryptographic key material.

Multiple JWKs can be published together as a **JSON Web Key Set (JWKS)**:

```json
{
  "keys": [
    {
      "kty": "RSA",
      "kid": "key-2026-01",
      "use": "sig",
      "alg": "RS256",
      "n": "...",
      "e": "AQAB"
    },
    {
      "kty": "RSA",
      "kid": "key-2026-02",
      "use": "sig",
      "alg": "RS256",
      "n": "...",
      "e": "AQAB"
    }
  ]
}
```

A verifier can use the token's `kid` to select the corresponding public key from the issuer's trusted JWKS.

JWT libraries can perform this resolution automatically when configured with a trusted JWKS endpoint:

```ts
const JWKS = createRemoteJWKSet(new URL('https://auth.example.com/.well-known/jwks.json'));

const { payload } = await jwtVerify(token, JWKS, {
  algorithms: ['RS256'],
  issuer: 'https://auth.example.com',
  audience: 'orders-api',
});
```

Publishing multiple keys also enables **key rotation**.

An issuer can begin signing new tokens with a new private key while continuing to publish the previous public key for tokens that were already issued. Once those older tokens can no longer be valid, the previous key can be removed from the published set.

The verifier's trust comes from its configured issuer and key source, not from arbitrary key locations supplied by an untrusted token.

---

# JWT Validation

A correctly structured JWT with a valid cryptographic signature is not automatically acceptable to an application.

**Signature verification** establishes that the protected token content has not been modified and that the signature corresponds to the expected verification key.

**JWT validation** determines whether that verified token is acceptable in the current context.

The verifier can constrain the algorithm, issuer, audience, and temporal conditions that define an acceptable token.

```ts
const { payload } = await jwtVerify(token, publicKey, {
  algorithms: ['RS256'],
  issuer: 'https://auth.example.com',
  audience: 'orders-api',
  clockTolerance: 5,
});
```

These constraints prevent a cryptographically valid token from being accepted outside the context for which it was issued. Clock tolerance can accommodate small differences between independently running system clocks.

Successful standard validation can still leave application-specific requirements to enforce.

For example, an endpoint may require a particular custom claim:

```ts
const { payload } = await jwtVerify(token, publicKey, {
  algorithms: ['RS256'],
  issuer: 'https://auth.example.com',
  audience: 'orders-api',
});

if (!payload.permissions?.includes('orders:write')) {
  throw new Error('Required permission is missing');
}
```

A token should only become trusted application context after every rule required by that recipient has succeeded.

This distinction is fundamental: **decoding reveals token contents, signature verification establishes cryptographic integrity, and validation determines whether the token is acceptable for a specific system and request context.**

---

# JWT Security Model

JWT protects the integrity and authenticity of claims, but it does not provide **confidentiality**. The Header and Payload are encoded rather than encrypted, so sensitive information should not be placed in them merely because the token is signed.

```ts
// Avoid placing secrets or sensitive credentials in JWT claims.
const token = await new SignJWT({
  userId: 'user-123',
  password: 'secret',
  creditCard: '4111...',
});
```

Possession of a valid JWT may be sufficient to use it when the surrounding system treats it as a **bearer token**. A valid signature does not prevent a stolen token from being replayed by another party.

Reducing token lifetime limits how long a captured token remains useful.

Signing keys form part of the JWT trust boundary. A compromised private key allows an attacker to produce signatures that verifiers trusting the corresponding public key may accept.

A compromised symmetric secret has an additional consequence: every system possessing that secret has the cryptographic capability to create valid signatures.

Key material should therefore be generated with appropriate cryptographic strength, protected from unauthorized access, restricted to systems that require it, and rotated when necessary.

Claims must not influence security-sensitive decisions before verification and validation succeed:

```ts
// Unsafe: decoding does not establish trust.
const payload = decodeJwt(token);

if (payload.role === 'admin') {
  grantAdminAccess();
}
```

Authorization-sensitive values should instead come from validated token data:

```ts
const { payload } = await jwtVerify(token, trustedKey, validationPolicy);

if (payload.role === 'admin') {
  grantAdminAccess();
}
```

JWT security therefore depends not only on producing a valid signature, but on preserving the trust boundary around signing keys, token possession, and validated claims.

---

# Putting Everything Together

JWT separates the creation of trusted claims from the systems that consume them.

![JWT Putting Everything Together](/docs/jwt/jwt-putting-everything-together.png)

Independent recipients can establish trust without receiving signing authority, while retaining control over the validation policy that determines which tokens they accept.
