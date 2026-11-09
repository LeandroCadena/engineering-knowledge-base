# GitHub Actions artifact handoff

Requires Node.js 24 and npm. This example packages a teaching JSON file, not the knowledge-base application. No cloud credentials, production deployment or attestation signing are included.

```bash
cd examples/github-actions
npm ci
npm test
export BUILD_COMMIT="$(git rev-parse HEAD)"
npm run package
npm run verify
```

`dist/app.json` contains the service name and full commit SHA. `dist/receipt.json` records the SHA, SHA-256 digest and byte length. Verification rejects changed bytes or a different expected revision. The four tests cover those boundaries and rejection of a branch name instead of a full SHA.

The repository workflow [delivery-graphql-examples.yml](../../.github/workflows/delivery-graphql-examples.yml) tests all three examples, packages once, uploads with short retention, and downloads into a separate job for verification. It uses `github.sha`, which on a normal `pull_request` event is the synthetic merge revision. It does not claim that value is the contributor's head SHA.

A matching receipt establishes consistency, not authenticity if an attacker replaces both files. Production promotion needs a trusted expected digest or verified provenance, restricted deployment authority, target health checks and a recovery plan. The workflow grants only read access to repository contents and never requests cloud credentials.

Primary references:

- [Workflow concepts](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflows)
- [Secure use](https://docs.github.com/en/actions/reference/security/secure-use)
- [OIDC deployment identity](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [Workflow concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)
