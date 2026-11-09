---
title: GitHub Actions / CI-CD
description: Workflow execution, event revisions, reproducible checks, artifacts, delivery boundaries, credentials, deployment coordination, and recovery.
icon: github-actions.svg
updatedAt: 2026-11-09
---

# GitHub Actions / CI-CD

Continuous integration validates changes frequently against a shared codebase. Continuous delivery keeps a validated release available for deployment; continuous deployment automatically releases changes that pass the configured gates. GitHub Actions executes workflows for these processes, but a green workflow proves only the checks it actually ran against the revision it selected.

A backend pipeline must connect source revision, dependency resolution, tests, packaged bytes and deployment target. If a deployment rebuilds from a moving branch or downloads an artifact from an unrelated run, the tested code and released code can differ even when both jobs succeed.

## Events, Revisions & Trust

A workflow is a YAML file in `.github/workflows`. An event starts a run; jobs execute on runners; steps within a job execute sequentially unless their conditions skip them. Jobs normally run independently, while `needs` creates dependencies. Files written by one job are not automatically available in another job, even when both jobs use the same runner label.

| Trigger               | Revision and operational concern                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pull_request`        | Normally tests a synthetic merge commit against the base branch. `github.sha` identifies that merge revision, not necessarily the contributor's head commit. |
| `push`                | Tests the pushed commit. A push to a feature branch is not authorization to deploy production.                                                               |
| `workflow_dispatch`   | Starts manually, with a selected ref and optional inputs. Restrict which refs and inputs can reach privileged jobs.                                          |
| `schedule`            | Runs against the default branch and can be delayed. It is unsuitable as a precise business scheduler.                                                        |
| `pull_request_target` | Runs in the base repository context. Checking out and executing untrusted PR code with its privileges can expose credentials.                                |

Choose whether to test the PR head, the proposed merge or the final main commit, and record that decision. A passing check on an earlier commit does not validate a later change. Before merging, inspect the checks associated with the current PR head and ensure the relevant workflows actually ran; path filters can skip an entire workflow.

Expressions and shell execution cross different boundaries. Never interpolate a PR title, branch name or user input directly into a shell program. Pass untrusted text through an environment variable and quote the variable, or handle it as data in a language API. Expression substitution happens before the shell interprets the command.

## Jobs, Dependencies & Failure Behavior

Use separate jobs for independent checks and a dependency chain for packaging and promotion. A matrix repeats a job for supported runtime versions, operating systems or independent examples. Set a timeout so a hung server or dependency cannot occupy a runner indefinitely. Matrix `fail-fast: false` keeps the other combinations running after one fails, which provides fuller diagnostic evidence.

```yaml
permissions:
  contents: read
concurrency:
  group: pr-checks-${{ github.ref }}
  cancel-in-progress: true
jobs:
  checks:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262
        with:
          persist-credentials: false
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020
        with:
          node-version: '24'
      - run: npm ci
      - run: npm test
```

The full commit pins select the reviewed action implementations. Update those pins deliberately; pinning an old implementation forever preserves its defects too. A runtime major such as `24` follows compatible runtime updates rather than fixing an exact patch. Choose exact patches or image digests when the release process needs that stronger reproducibility boundary.

A dependent job is normally skipped if a dependency fails or is skipped. Use `if: always()` selectively for diagnostics and cleanup, not to allow deployment after failed validation. `continue-on-error` can turn a failed experiment into a nonblocking result; using it on a release gate silently weakens the gate.

A repository should require an aggregate check whose logic accounts for every required component. A green lint check cannot substitute for skipped database integration tests. Changes to workflow files, build scripts, dependency manifests and migrations deserve validation because they change what the pipeline executes.

## Dependencies, Caches & Artifacts

`npm ci` installs from the committed lockfile and rejects a manifest/lockfile mismatch. It still executes dependency lifecycle scripts unless configured otherwise. A lockfile fixes dependency resolution; it does not prove that dependencies are trustworthy or that an external service will behave identically tomorrow.

A cache accelerates work that can be recreated, such as downloaded npm packages. Its key should include the relevant lockfile, runtime and platform where necessary. A cache miss should affect speed, not correctness. Do not treat cache contents as the authoritative release output or store secrets in a shared cache.

An artifact transfers an explicit output between jobs or preserves evidence after a run. Upload a built package, image metadata or test report, then download the artifact from the intended run and attempt. Give artifacts bounded retention and avoid accidentally uploading environment files, credentials or customer data.

![Validation precedes packaging; a separate job downloads the same artifact and verifies its revision and digest.](/docs/github-actions/v1/artifact-flow.svg)

Build once, identify the output immutably, and promote those bytes across environments. For containers, deploy an image digest instead of relying on a mutable tag. Record the source commit, build run, artifact digest and destination release so an incident can be traced backward.

The included example creates a small JSON package and a receipt containing the full commit SHA, byte count and SHA-256 digest. Another job downloads the artifact and verifies those values. Four tests cover unchanged bytes, tampering, revision mismatch and invalid revision identifiers. This demonstrates artifact handoff, not deployment of this knowledge-base app.

A digest detects a mismatch against a trusted expected value. If an attacker can replace both a package and its receipt, their matching digest does not establish authenticity. Signed provenance or artifact attestations add claims tied to a verified build identity; consumers must verify the issuer, repository, workflow and revision policy rather than merely checking that an attestation exists.

:::check{question="An artifact passes its digest check, but its receipt was replaced together with the package. What does that check establish?"}
Only internal consistency between the supplied receipt and bytes. Authenticity requires an independently trusted expected digest or verified provenance tied to an authorized build identity and source revision.
:::

## Credentials & Deployment Authority

`GITHUB_TOKEN` is scoped to a job's configured permissions and repository context. Start with read access and grant only the permissions a specific job requires. A workflow that only tests code should not be able to publish packages, modify repository contents or request cloud credentials. Fork PRs have restricted secret/token behavior; do not weaken that boundary to make an untrusted build work.

A secret can be leaked by malicious build code, a dependency install script, an action or a compromised runner. Log masking reduces accidental disclosure; it does not make arbitrary execution safe. Restrict write access to workflow files and review third-party actions. Persistent self-hosted runners can retain files, processes or credentials between jobs; avoid scheduling untrusted contributions on a privileged shared runner.

OpenID Connect exchanges a short-lived GitHub identity token for cloud credentials. A job needs `id-token: write` to request that token, but the cloud must separately trust the issuer and enforce audience and subject constraints. Bind the trust policy to the intended organization, repository, branch or protected environment. A wildcard subject can let an unintended branch assume a powerful role without stealing a stored secret.

Use environments to define deployment targets, required reviewers where supported, branch/tag restrictions and target-specific secrets. A production credential belongs only in the authorized deployment job after validation. A manual approval is useful only if the approver can identify the artifact, changes and destination they are approving.

Separate building from releasing. A PR workflow can produce evidence without authority to deploy. A trusted release workflow can verify an immutable output and then obtain narrowly scoped credentials. Avoid patterns where a privileged follow-up workflow executes scripts or artifacts supplied by an untrusted PR without verifying their origin and treating their contents appropriately.

## Deployment Coordination & Recovery

Canceling an obsolete PR check saves time. Canceling a production job halfway through a migration can leave the system in an intermediate state. Concurrency groups coordinate runs sharing a key, but they are not a database lock and should not be assumed to provide a durable first-in-first-out release queue. Design deployment steps to be repeatable and reconcile actual state after cancellation.

A release normally verifies configuration, applies a compatible change, waits for readiness and observes real traffic indicators. A process starting successfully is weaker evidence than successful requests with acceptable error rate and latency. Define what stops promotion and who or what can recover it.

Application rollback does not reverse database mutations or external side effects. Use expand-and-contract migrations: add compatible structures, deploy code that can operate during the transition, migrate data, then remove old structures after older code is no longer needed. A destructive migration can make a previous binary unusable even if the deployment system retains its image.

Retries are appropriate for classified transient failures. Retrying a payment, migration or release command without idempotency can duplicate effects. Record completed steps and use operation identities where the target supports them. Capture diagnostics before cleanup so a retry does not erase the cause of failure.

:::check{question="Why is a green build insufficient evidence that production contains the tested version?"}
The deployment may rebuild from a moving branch, download an unrelated artifact or use a mutable image tag. Link the checked revision to an immutable artifact and verify that the deployment targets that exact output.
:::

## Diagnosing a Pipeline

Start with the triggering event, selected SHA and workflow revision. Then identify whether the failure concerns checkout, dependency resolution, compilation, test execution, packaging, authentication or deployment health. A timeout while starting PostgreSQL requires different evidence from a failing assertion after the schema is ready.

Retain test reports, failure logs and relevant environment metadata without publishing secrets. For container failures, capture process exit status and dependency logs. For deployment failures, capture the attempted revision, rollout status and readiness failures. Measure queue time separately from execution time; a slow runner queue cannot be fixed by optimizing a unit test.

The included workflow runs three isolated example suites, packages the teaching artifact, downloads and verifies it, and provisions a disposable Kubernetes cluster for a rollout exercise. Its cloud deployment authority is intentionally absent. Successful execution proves these checks for the selected revision; it does not prove production capacity, cloud IAM policy or application compatibility with every real database migration.

:::check{question="A new release fails readiness after a schema migration. Is redeploying the previous image always a safe rollback?"}
No. The previous image must still understand the current schema and data. Check compatibility and side effects; an expand-and-contract migration preserves a rollback window, while a destructive migration may require a forward fix or explicit data recovery.
:::

[Runnable artifact example and workflow](https://github.com/LeandroCadena/engineering-knowledge-base/tree/main/examples/github-actions)
