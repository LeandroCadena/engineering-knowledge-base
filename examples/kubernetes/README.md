# Kubernetes readiness, failed rollout and rollback

Requires Node.js 24/npm for the local test. The cluster exercise additionally requires Docker, kind, kubectl and curl. It creates a disposable, single-node cluster named `kb-example`; it does not connect to production infrastructure.

```bash
cd examples/kubernetes
npm ci
npm test
```

The HTTP test opens an ephemeral loopback port, checks readiness, switches to draining, verifies readiness fails while liveness stays healthy, checks the version, then closes the server. It does not simulate SIGTERM from a real orchestrator; the cluster exercise verifies probe/rollout behavior separately.

Run the cluster commands from the repository root:

```bash
kind create cluster --name kb-example --image kindest/node:v1.34.0@sha256:7416a61b42b1662ca6ca89f02028ac133a309a2a30ba309614e8ec94d976dc5a --wait 120s
docker build -t kb-demo:v1 examples/kubernetes
kind load docker-image kb-demo:v1 --name kb-example
bash examples/kubernetes/verify-cluster.sh
kind delete cluster --name kb-example
```

The script refuses a current context other than `kind-kb-example`. It applies a two-replica Deployment and ClusterIP Service, waits for v1 readiness, changes an environment value to v2, then breaks the next revision's readiness path. The bad rollout must fail to complete within 20 seconds, and two service endpoints must remain ready. It restores the prior revision and checks two ready/updated replicas.

Version checks use a local port-forward. This tests an HTTP response through the debugging tunnel, not the ClusterIP networking data path or external routing. EndpointSlice assertions independently check ready endpoint membership during the bad rollout. The single-node cluster does not validate multi-node availability, load, DNS, persistent storage, RBAC policy or NetworkPolicy enforcement.

The manifest uses `imagePullPolicy: Never` because kind loads the local teaching image. Production deployments normally pull an immutable registry digest. The Dockerfile fixes a Node image tag but does not pin its digest. Do not copy this local image distribution approach as a release pipeline.

The process handles SIGTERM by failing readiness and closing its HTTP server, with a bounded forced exit. This is a lifecycle example, not proof of zero dropped connections through a real load balancer. The container runs non-root with a read-only root filesystem, dropped capabilities and no mounted service-account token.

The [CI workflow](../../.github/workflows/delivery-graphql-examples.yml) installs versioned kind/kubectl after checksum verification, creates this cluster, runs the exercise, captures diagnostics on failure and always removes the disposable cluster. It has no cloud deployment credentials.

Primary references:

- [Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Probes](https://kubernetes.io/docs/concepts/workloads/pods/probes/)
- [Services](https://kubernetes.io/docs/concepts/services-networking/service/)
- [Container resources](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)
- [Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)
- [NetworkPolicy](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
