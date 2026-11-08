---
title: TLS
description: TLS 1.3 handshake, certificate paths and service identity, traffic keys, resumption and replay, mutual TLS, termination boundaries, and Node.js verification.
icon: tls.svg
updatedAt: 2026-11-08
---

# TLS

Transport Layer Security protects communication against network eavesdropping and undetected modification, while authenticating peers under a configured trust model. HTTPS carries HTTP over a protected transport; the application still needs authorization, input validation and safe credential handling.

A backend calling an Orders API must establish that it reached the intended service, not merely that some endpoint negotiated encryption. A valid API key sent through an unverified connection can be delivered confidentially to an attacker rather than to the real API.

## Protocol & Trust Boundaries

TLS uses a handshake to negotiate parameters and establish keys, then a record layer to protect application bytes. Different application protocols use that protected channel, including HTTP, database protocols and messaging. HTTP/3 uses QUIC with the TLS 1.3 handshake integrated into its transport rather than ordinary TLS records over TCP.

TLS does not encrypt data after an endpoint decrypts it. Logs, application memory, databases and reverse-proxy hops have separate exposure boundaries. Network observers can also learn metadata such as destination addresses, traffic sizes and timing even when payloads are encrypted.

In common server-authenticated TLS, the client validates the server's certificate and proof of private-key possession. The server does not thereby learn which human or API client connected. Mutual TLS adds client-certificate authentication; API credentials and object authorization remain application decisions.

## Cryptographic Roles

Modern TLS combines mechanisms with distinct responsibilities. It is not “encrypt everything with the certificate's public key,” and a signature is not simply encryption run backward.

| Mechanism                           | Role in a typical certificate-based TLS 1.3 connection                                    |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| Ephemeral key agreement             | Both peers derive shared secret material without transmitting the resulting traffic keys. |
| Certificate and handshake signature | Authenticate the server's key and bind its private-key proof to this handshake.           |
| Hashes and key derivation           | Summarize the transcript and derive distinct secrets for defined stages/directions.       |
| Authenticated encryption, AEAD      | Encrypt traffic and detect modification of protected records.                             |
| Finished messages                   | Confirm possession of derived handshake secrets and integrity of the transcript.          |

For example, ephemeral elliptic-curve Diffie–Hellman supplies key agreement, an RSA or elliptic-curve signature can authenticate the handshake, and AES-GCM or ChaCha20-Poly1305 protects records. Algorithm names are not interchangeable: an RSA signing certificate does not mean TLS 1.3 uses RSA key transport.

A plain hash is not a message-authentication proof. Anyone able to change plaintext can also recompute an unkeyed checksum. TLS derives secret keys and uses authenticated constructions rather than asking a receiver to trust an attacker-supplied digest.

## TLS 1.3 Handshake

A typical full certificate-based handshake begins with a ClientHello containing supported versions, cipher suites, key shares and extensions. The ServerHello selects compatible parameters and a key share. The peers can then derive handshake protection keys from their agreement.

The server's later handshake flight includes encrypted extensions, its certificate chain, CertificateVerify and Finished. The client validates the certificate path and service identity, verifies the handshake proof and Finished, and sends its own Finished. Application traffic uses separately derived traffic secrets.

![TLS 1.3 hello messages establishing handshake keys before the encrypted certificate and Finished exchange, followed by protected application traffic.](/docs/tls/v2/handshake-stages.svg)

Encryption therefore begins before every handshake message has completed. TLS 1.3 encrypts the server certificate flight after ServerHello; a blanket statement that encryption starts only after the entire handshake is incorrect. The ordinary full-handshake application exchange still waits for the required authentication and Finished checks.

A HelloRetryRequest can ask for a different key share, adding a round trip. Resumption and early data have different sequences. The diagram describes the ordinary full handshake and does not claim that every TLS connection uses exactly those messages.

The handshake transcript binds negotiated parameters and proofs together. A certificate copied from a legitimate server is not enough for an impersonator to complete the private-key proof for a new handshake.

## Certificates, Chains & Service Identity

A certificate binds a public key to identifiers and constraints under an issuer's signature. Its contents include a subject public key, validity window, issuer, subject alternative names, and extensions describing permitted use. A typical web certificate authenticates control of a service name; it does not certify that the application is honest or free of vulnerabilities.

The server commonly sends its leaf and intermediate certificates. The client builds and validates a path to a locally trusted anchor, checking signatures, validity and applicable constraints. Merely including a self-signed root in the server's chain does not make that root trusted by the client.

![A certificate path reaching a configured trust anchor, with the requested service name checked independently against the leaf certificate.](/docs/tls/v2/service-identity.svg)

Service identity validation is separate from path validation. The client compares the intended DNS name or IP address with the appropriate subject alternative name. Modern service-identity rules use SANs rather than relying on Common Name fallback; an IP connection needs the appropriate IP identity if it is verified as an IP address.

A certificate for `billing.example.test` can chain to a trusted CA and still be unacceptable for `orders.example.test`. Do not replace name checking with “the certificate is signed” or accept whichever hostname a redirected endpoint presents.

Trust stores vary among browsers, operating systems and runtimes. For private services, install the intended private CA through controlled configuration rather than disabling verification. In Node.js, supplying a `ca` option changes the trust configuration for that connection; it should not be treated as an unrelated informational field.

Expiration, revocation information and certificate transparency are different parts of the operational ecosystem. Clients do not all perform identical online revocation checks by default. Do not assume a stolen certificate becomes instantly rejected everywhere merely because an operator requested revocation.

:::check{question="The server's certificate chains to a trusted CA but names a different service. Is encryption sufficient to send the API key?"}
No. The connection must authenticate the intended service identity as well as its certificate path. Otherwise the client can send its secret through an encrypted channel to the wrong peer.
:::

## Versions, Cipher Suites & Extensions

Prefer TLS 1.3 where supported and use a maintained TLS 1.2 configuration when compatibility requires it. SSL and TLS 1.0/1.1 are obsolete choices for new service configuration. Set and verify the supported version range at the actual TLS endpoint, which can be a load balancer rather than the Node process.

TLS 1.3 cipher suites select the AEAD algorithm and hash, such as `TLS_AES_128_GCM_SHA256`. Key-exchange groups and signature algorithms are negotiated separately. TLS 1.2 suite names can encode a broader combination, so explanations of one version's suite structure must not be applied mechanically to the other.

Server Name Indication, SNI, lets a client indicate the intended hostname during the handshake so a shared endpoint can choose a certificate or configuration. SNI is not itself successful hostname verification. A client can send a correct SNI value while still accepting an invalid certificate if verification has been disabled.

ALPN negotiates the application protocol, such as `h2` or `http/1.1`. TLS version and HTTP version are different axes. Negotiating TLS 1.3 does not mean the peers automatically speak HTTP/2, nor does an HTTP/1.1 response imply obsolete encryption.

The basic ClientHello can expose the requested name through SNI. Encrypted ClientHello changes that visibility when supported and configured; ordinary HTTPS alone must not be described as hiding every destination identifier.

## Traffic Keys & Forward Secrecy

TLS derives separate secrets for handshake and application traffic, and for each direction. A connection is not protected by one permanent key reused identically for everything. TLS 1.3 can update traffic keys without issuing a new certificate.

Ephemeral Diffie–Hellman in the full handshake provides forward secrecy with respect to later compromise of the long-term authentication key, assuming ephemeral secrets were not retained or compromised. An attacker who recorded encrypted traffic cannot simply decrypt that old connection after obtaining the server's certificate private key.

This property does not protect plaintext logged by the server, a compromised endpoint during the connection, or every possible pre-shared-key mode. Key agreement, certificate signing, traffic secret handling and endpoint security have distinct consequences.

Certificate renewal and traffic-key updates are also different operations. Replacing an expiring certificate affects authentication for subsequent handshakes; existing connections do not necessarily renegotiate or close immediately when a certificate file changes.

## Resumption & Early Data

Session resumption can use tickets and pre-shared-key material from an earlier connection to reduce handshake work. The server's ticket protection and lifetime policy become part of the trust boundary. A resumed TLS session is not an application login session or permission to skip API credential checks.

TLS 1.3 optionally supports 0-RTT early data sent before the new handshake completes. Its replay properties differ from ordinary protected application traffic. An attacker can replay an early request under conditions the protocol and deployment must address.

Do not assume a record authentication tag makes a purchase or cancellation execute once. Only allow early data for operations whose semantics and anti-replay design tolerate it, and account for intermediaries and retries. Many backend deployments can avoid that complexity by not enabling early data.

The companion uses full handshakes with an Agent disabled to avoid connection/session reuse. It does not implement resumption, ticket management or 0-RTT testing.

:::check{question="A 0-RTT request has encrypted, authenticated bytes. Does that guarantee an order creation cannot be replayed?"}
No. Early-data replay is a separate protocol concern. Application semantics and deployment anti-replay behavior must account for it; encryption and integrity alone do not guarantee one business effect.
:::

## Mutual TLS & Client Authorization

With mutual TLS, the server requests a client certificate and verifies its path and handshake proof under a configured trust policy. The client still validates the server. This can authenticate a workload or managed device without transmitting a shared bearer secret.

A trusted client certificate is not automatically a permission to access every API. Map the validated certificate identity to an allowed workload, account or authorization policy. Trusting a broad organizational CA without constraining which issued identities are accepted can admit unrelated clients.

At a TLS-terminating proxy, the application may receive a derived client identity through a protected internal channel. Strip attacker-supplied identity headers and only trust assertions from the configured proxy boundary. Reading `X-Client-Cert` from an arbitrary internet request does not perform mutual TLS.

The companion optionally requires a client certificate signed by its temporary fixture CA, then still requires an API key. It demonstrates two independent checks, not a complete certificate-to-workload authorization directory. The CA issues only fixture identities; production mappings and revocation are outside that example.

:::check{question="A client certificate chains to the configured private CA. Does that authorize reading every tenant's orders?"}
No. Mutual TLS authenticates the peer under its certificate policy. The API must map that identity and enforce the permitted client, operation and tenant boundaries; trusting a CA is not universal resource authorization.
:::

## TLS Termination & Internal Hops

A reverse proxy can terminate the browser's TLS connection and create a separate upstream connection. The application sees decrypted HTTP at that boundary unless the upstream hop is also protected. Re-encrypting with an unverified internal certificate does not authenticate the upstream service.

![Client-to-proxy and proxy-to-service connections as separate transport trust boundaries, with application authorization after termination.](/docs/tls/v2/termination-hops.svg)

Configure proxy trust narrowly when using forwarded scheme, client IP, host or certificate identity. A forged forwarded HTTPS value must not cause the application to believe an untrusted request satisfied transport policy. Redirects, Secure cookies and callback construction can all depend on that configuration.

HTTP Strict Transport Security tells supporting browsers to use HTTPS for a host under its policy. It does not validate a certificate, protect arbitrary backend HTTP clients, or repair the first unprotected request before the browser knows the policy unless a preload mechanism applies.

## Node.js Client Verification

Node's HTTPS client verifies certificates by default. Preserve that behavior and add the private CA when intentionally calling a private service. The companion connects to loopback while using a fixture DNS service identity:

```js
import https from 'node:https';

const request = https.request({
  host: '127.0.0.1',
  port: fixturePort,
  servername: 'orders.example.test',
  ca: fixtureCa,
  minVersion: 'TLSv1.3',
  maxVersion: 'TLSv1.3',
  rejectUnauthorized: true,
  agent: false,
  method: 'GET',
  path: '/orders/ord_a',
  headers: { 'X-API-Key': fixtureKey },
});
```

The fixture's narrow TLS 1.3 range is an explicit test policy, not a universal requirement to exclude correctly configured TLS 1.2 peers. A real deployment should define its own compatibility range and test both the client and terminating endpoint.

`servername` supplies the service name for SNI and verification in this HTTPS configuration. Do not override `checkServerIdentity` with a callback that always succeeds. Setting `rejectUnauthorized: false` or globally disabling TLS rejection suppresses authentication rather than fixing an unknown CA or wrong name.

Bound connection and request duration, handle the error event, and close owned sockets. HTTP errors such as 401 or 403 occur after a successful TLS connection; a certificate rejection occurs before the protected HTTP request reaches the application. Retrying every category identically hides configuration defects and can amplify failures.

## Certificate Operations & Diagnosis

Automate renewal before expiry, protect private-key access, and monitor the certificate actually served from every relevant endpoint. Renewing a file is insufficient if a proxy still serves the old chain or a process never reloads its secure context.

```sh
openssl s_client -connect orders.example.test:443 \
  -servername orders.example.test \
  -verify_hostname orders.example.test \
  -verify_return_error -CAfile private-ca.pem </dev/null
```

This inspects a handshake using the specified trust anchor and hostname. `s_client` is a diagnostic tool: explicitly request verification failure behavior rather than assuming that printing a certificate means it was accepted. Do not include API secrets in a transcript shared for debugging.

| Symptom                           | Boundary to inspect                                                      |
| --------------------------------- | ------------------------------------------------------------------------ |
| Unknown issuer or incomplete path | Client trust store and server-supplied intermediates.                    |
| Hostname mismatch                 | Expected service name, SAN entries, SNI and endpoint routing.            |
| Expired/not-yet-valid certificate | Served leaf/intermediates, renewal/reload and clock.                     |
| No shared protocol/algorithm      | Actual version range, groups, signature policy and client compatibility. |
| Missing client certificate        | Mutual-TLS configuration and intended client identity material.          |
| HTTP 401/403 after handshake      | Application credential and authorization policy.                         |

Record sanitized handshake failure categories and negotiated parameters where useful. Never log private keys, TLS session secrets, or raw API credentials. Debug key-log material can decrypt captured traffic and needs a stricter handling policy than an ordinary request ID.

[Executable example and setup instructions](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/api-keys-tls-readings/examples/api-keys-tls-readings)
