---
title: Kubernetes
description: Reconciliation, workloads, service discovery, resources, probes, rollouts, storage, security boundaries, and cluster diagnostics.
icon: kubernetes.svg
updatedAt: 2026-11-09
---

# Kubernetes

Kubernetes reconciles declared workload state with running processes across a cluster. A Deployment declaring two replicas asks controllers to maintain two matching Pods; it does not guarantee two healthy application instances, two independent failure domains or correct business behavior.

For a backend API, the operational chain is concrete: schedule a Pod, start its container, let initialization finish, mark it ready, publish it as an eligible service endpoint and replace it safely during an update. A failure anywhere in that chain can leave a valid manifest with no usable API.

## Control Plane & Reconciliation

The API server validates and exposes cluster objects. `etcd` stores control-plane state; protecting and recovering that state is part of operating a cluster. Controllers compare observed state with desired state and create or update resources. The scheduler assigns unscheduled Pods to suitable nodes. Each node's kubelet asks a container runtime to run the assigned containers and reports their state.

A Deployment owns ReplicaSets, which maintain Pods matching their template. Updating the Pod template creates a new revision and usually a new ReplicaSet. A deleted managed Pod is replaced with another Pod, not resurrected with the same identity and local filesystem. A running Pod is generally not moved to another node; replacement creates a new instance.

`kubectl apply` submits desired configuration. Its successful exit means the API accepted the change, not that the application is ready. Follow it with rollout checks and application-level verification. Controllers reconcile asynchronously, so observe status conditions and events rather than assuming every field changes immediately.

| Workload      | Appropriate responsibility                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Deployment    | Replaceable, usually stateless replicas such as an HTTP API.                                                             |
| StatefulSet   | Stable Pod identities and ordered behavior with associated storage; application replication remains your responsibility. |
| Job / CronJob | Finite work / scheduled Job creation. Retries and overlapping executions require idempotent business operations.         |
| DaemonSet     | A Pod on each eligible node, often for infrastructure agents.                                                            |

Do not use an init container as a globally exclusive database migration lock. Multiple replicas or releases can initialize concurrently. Run migrations as a separately controlled operation and use a database-backed lock or migration tool where exclusivity is necessary.

## Pods, Services & Traffic

Containers in a Pod share a network namespace and can communicate over localhost. They may share explicitly mounted volumes, but they do not automatically share every filesystem path. A Pod is the scheduling and lifecycle unit; placing unrelated services together couples their scaling and replacement.

Pod IP addresses change. A Service provides a stable name and virtual access point selected by labels. EndpointSlices describe the selected endpoints and their conditions. A wrong selector can leave a healthy Deployment unreachable through its Service. A wrong `targetPort` can forward traffic to a port where nothing listens.

![The Service selector identifies Pods; readiness determines endpoint eligibility independently of process liveness.](/docs/kubernetes/v1/service-readiness.svg)

Cluster DNS resolves service names. A ClusterIP Service is normally reachable within the cluster; a LoadBalancer Service requests an implementation-specific external load balancer. HTTP routing through Ingress requires an ingress controller; creating an Ingress resource alone does not implement traffic handling. Gateway API likewise needs a compatible controller. TLS termination, forwarded headers, timeouts and request limits depend on that routing layer's configuration.

A readiness failure normally removes a Pod from regular service traffic once endpoint updates propagate. Existing connections, external balancers and proxies have their own timing. A local port-forward is a debugging tunnel; it does not prove that the normal Service data path, external routing or DNS works.

## Requests, Limits & Scaling

A container's resource request influences scheduling and CPU allocation under contention. A CPU limit caps consumption through throttling, which can increase latency while the process remains healthy. A memory limit can lead to an OOM kill when exceeded. Memory is not throttled into safety like CPU time.

```yaml
resources:
  requests:
    cpu: 250m
    memory: 256Mi
  limits:
    cpu: '1'
    memory: 512Mi
```

`250m` is one quarter of a CPU core. These values are an example, not a recommendation for every Node.js service. Measure steady-state usage, startup peaks, allocation spikes and latency under contention. An excessively low request overpacks a node; an excessively high request can leave Pods Pending even when observed utilization looks low.

The HorizontalPodAutoscaler adjusts a workload's replica count using configured metrics. CPU utilization targets are evaluated relative to requests and need a working metrics source. Scaling replicas does not create node capacity; node provisioning is a separate mechanism. Queues, connection pools and downstream rate limits can make additional replicas harmful instead of helpful.

Distribute replicas across failure domains with topology spread or affinity policies when availability requires it. Two Pods on the same node do not survive that node's failure together. A PodDisruptionBudget restricts supported voluntary disruptions; it does not prevent hardware failure, guarantee spare capacity or control a Deployment's rollout strategy.

:::check{question="An API has two replicas and a disruption budget. Does it necessarily survive a node failure?"}
No. Both replicas may share that node, and a disruption budget cannot prevent involuntary failures. Availability also needs placement across failure domains, healthy capacity, working routing and dependencies that survive the same failure.
:::

## Startup, Readiness & Liveness

A startup probe gives slow initialization time before readiness and liveness checks begin. Readiness asks whether this instance should currently receive traffic. Liveness asks whether the container is stuck in a state that requires restarting it. Failed readiness does not itself restart a container; repeated liveness or startup probe failures can.

| Situation                                     | Useful response                                                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Initial caches or configuration still loading | Startup not complete; do not admit traffic.                                                                   |
| Instance draining before termination          | Readiness false while in-flight work completes.                                                               |
| Shared database temporarily unavailable       | Consider readiness policy and upstream behavior; restarting every replica is unlikely to repair the database. |
| Event loop permanently wedged                 | A bounded liveness failure can trigger recovery.                                                              |

Do not make liveness depend on every remote service. A shared outage can otherwise restart the whole fleet and add load during recovery. Conversely, a trivial readiness endpoint that always succeeds cannot detect an instance unable to perform its required work. Choose checks based on the failure they are supposed to change.

The example exposes `/live`, `/ready` and `/version`. On SIGTERM it marks the instance unready, stops accepting new HTTP connections and allows existing work time to finish. Kubernetes gives a termination grace period and eventually forces termination. This small server demonstrates lifecycle handling; it does not prove zero dropped requests through a production proxy or completion of arbitrary background jobs.

## Rolling Updates & Rollback

A rolling Deployment gradually replaces old Pods. `maxSurge` bounds extra Pods above the desired count; `maxUnavailable` bounds how far availability may fall during the update. With two replicas, `maxSurge: 1` and `maxUnavailable: 0`, a new Pod must become available before an old available Pod can be removed. The cluster needs capacity for the extra Pod.

Readiness is therefore a release gate. If a new revision starts but never becomes ready, the old ready revision can continue serving while rollout completion stalls. Configure a progress deadline and monitor conditions; a failed progress deadline reports a problem rather than automatically reverting the Deployment.

`kubectl rollout undo deployment/demo-api` restores a retained Pod-template revision. It does not reverse database migrations, external API calls or changes to separate ConfigMap objects. An old template referring to a mutable image tag or mutable configuration may not reproduce the original release. Deploy immutable image digests and version configuration where reproducibility matters.

The included CI exercise creates a single-node kind cluster, loads a local image, deploys two replicas and waits for readiness. It updates a version variable, deliberately breaks the next revision's readiness path, verifies the rollout cannot complete and checks that two endpoints remain ready. It then rolls back and verifies that two replicas of the restored revision are ready. This is a real control-plane exercise, not a production high-availability or load test.

:::check{question="A rollout is stuck with one new unready Pod and two old ready Pods. Why can that be the correct behavior?"}
With two desired replicas, one surge Pod and zero allowed unavailability, the controller preserves the old ready instances until the new revision becomes available. Inspect its readiness failure instead of deleting healthy old Pods to force progress.
:::

## Configuration, Storage & Authority

ConfigMaps hold ordinary configuration; Secrets hold values needing restricted access. Base64 encoding in a Secret manifest is not encryption. Configure encryption at rest where required, restrict API access, avoid committing secret values and prefer an appropriate secret-management integration. Environment variables are read when a container starts; changing the source object does not update an already running process's environment. Mounted configuration updates also require the application to reload it, and some mounting patterns do not receive updates.

A container's writable layer is ephemeral. `emptyDir` can share temporary data across containers in a Pod and survive a container restart, but disappears with the Pod. A PersistentVolumeClaim requests persistent storage through a storage implementation. Access modes, topology, provisioning and reclaim policy affect how it can be mounted and what survives deletion. A persistent disk is not a backup; test restore procedures and application consistency.

Service accounts identify workloads to the Kubernetes API. RBAC controls their allowed API operations. If an API service needs no Kubernetes API access, disable automatic service-account token mounting. Use namespace-scoped least privilege and avoid granting broad cluster-admin access to deployment jobs or application Pods.

Run containers as non-root where possible, disallow privilege escalation, drop unnecessary capabilities and use a read-only root filesystem if the application supports it. These controls reduce impact; they do not repair an authorization defect in the API.

NetworkPolicy expresses allowed network connections, but enforcement requires a supporting network implementation. Namespaces alone do not isolate network traffic. Apply default-deny and explicit ingress/egress rules when needed, including DNS and legitimate dependency traffic. A policy object that the installed networking layer does not enforce provides no traffic isolation.

## Diagnosing an Unavailable API

```bash
kubectl get deployment,pods,service,endpointslices
kubectl describe pod <pod-name>
kubectl logs <pod-name> --previous
kubectl rollout status deployment/demo-api --timeout=120s
kubectl get events --sort-by=.metadata.creationTimestamp
```

Choose the namespace and context explicitly for real operational commands. A Pending Pod points toward scheduling constraints, capacity, image storage or volume attachment. `ImagePullBackOff` points toward image reference, registry credentials or connectivity. `CrashLoopBackOff` describes repeated exits and backoff; inspect exit codes and previous logs to find the cause.

For a running but unready Pod, inspect probe path, port, startup behavior and dependency failures. For a ready but unreachable API, inspect Service selectors, EndpointSlices, target ports, network policy and external routing. For latency, examine throttling, memory pressure, node contention and downstream saturation before increasing replicas.

:::check{question="A Secret contains a base64-encoded password and an RBAC rule allows reading it. Is the password protected from that reader?"}
No. An authorized reader can decode the value. Restrict access, protect stored data and secret delivery, and rotate exposed credentials; base64 is a representation, not a confidentiality boundary.
:::

[Runnable kind deployment and failure exercise](https://github.com/LeandroCadena/engineering-knowledge-base/tree/main/examples/kubernetes)
