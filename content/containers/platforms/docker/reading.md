---
title: Docker
description: Images and build inputs, container isolation and lifecycle, storage, networking, Compose readiness, runtime configuration, resource limits, registries, and failure diagnosis.
icon: docker.png
updatedAt: 2026-11-08
---

# Docker

Docker builds and distributes container images and runs processes from those images. An image packages application files, a runtime and user-space dependencies. A container combines that image with runtime configuration, isolated operating-system resources and a writable filesystem layer. The application still needs compatible hardware, a kernel, configuration and any external services it uses.

An Orders API can run from the same image in development and production while receiving different database addresses and credentials. Reusing the artifact reduces differences in installed dependencies; it does not make the databases, network policies or host resources identical.

This reading covers Linux containers, Docker Engine, BuildKit builds and the current Compose specification through `docker compose`. Windows containers have different kernel and isolation requirements. Kubernetes and managed container services add scheduling and deployment behavior beyond the single-host mechanisms described here.

## Engine, Images & Isolation

The Docker CLI sends API requests to a Docker daemon, which may be local or remote. The daemon manages images, networks, volumes and container lifecycle; lower-level components such as containerd and an OCI runtime perform container execution. BuildKit executes image builds. A command reaching the wrong Docker context can build or stop resources on a different machine, so context and daemon identity are part of diagnosis.

A Linux container runs processes using the host kernel. Namespaces isolate views of resources such as process IDs, network interfaces and mounts. Control groups account for and constrain resources such as memory and CPU. Capabilities and security profiles restrict privileged operations. These controls serve different purposes: a separate process namespace does not impose a memory limit.

Docker Desktop typically runs Linux containers inside a Linux virtual machine on macOS or Windows. Those containers share the VM's kernel, rather than executing Linux system calls directly against the macOS or Windows kernel. Filesystem sharing, networking and available memory cross that VM boundary.

An image is not a virtual-machine snapshot and does not contain its own Linux kernel. It also does not contain the running database, secrets or data volume merely because the application connects to them. Images for `linux/amd64` and `linux/arm64` contain different platform-specific artifacts; selecting or emulating a compatible platform matters for native Node.js modules as well as the runtime itself.

## Image Layers & Container State

An image consists of read-only filesystem layers and configuration such as the default command, environment and user. Containers created from it share those image layers but have separate writable layers. Creating a second container does not copy the first container's runtime changes into the image.

A filesystem change may require copying data from a lower layer into the writable layer before modification. This copy-on-write behavior avoids eagerly duplicating the whole image. Exact storage implementation depends on the daemon's configured backend; application data should not depend on its internal host paths.

![Shared image layers, independent writable layers and a persistent volume](/docs/docker/v2/layers-storage.svg)

Stopping and starting the **same container** preserves its writable layer. Removing that container removes the layer. A newly created replacement starts from the image again. Neither `docker restart` nor `docker start` upgrades a container to a newer image or changes the environment recorded when it was created.

Deleting a file in a later image layer hides it from the final filesystem view; it does not erase the bytes from earlier layers. Copying a credential into an image and removing it in a later `RUN` instruction leaves that credential recoverable from the image layers. Prevent the copy rather than rely on deletion.

:::check{question="An API writes uploaded files under /app/uploads without a mount. Do the files survive a restart? What changes when the container is replaced?"}
A stop/start or restart of the same container retains its writable layer. Removing it and creating a replacement loses those files. A volume, bind mount or external object store gives uploads a lifecycle separate from the container; a backup policy still has to protect that storage.
:::

## Dockerfiles & Build Inputs

A Dockerfile describes image construction and image defaults. The build context supplies files available to `COPY` and `ADD`; it is not necessarily the directory containing the Dockerfile. For `docker build -f deploy/Dockerfile .`, the final `.` selects the context. An instruction cannot freely copy arbitrary parent directories outside it.

A `.dockerignore` excludes files from that context, avoiding accidental inclusion of local dependencies, credentials, generated output and repository history. It is separate from `.gitignore`: an untracked `.env` file can still enter a build context if Docker does not exclude it.

```dockerfile
# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS verify
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY test ./test
RUN npm test

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data
WORKDIR /app
RUN mkdir /data && chown node:node /data
COPY --from=verify /app/dist ./dist
USER node
EXPOSE 8080
CMD ["node", "dist/server.js"]
```

The example's `npm test` compiles TypeScript and runs application tests. The final stage copies compiled JavaScript from that verified stage. It does not inherit its TypeScript compiler, test files or `node_modules`. This application uses only Node built-ins; an application with runtime packages must also copy or install its production dependencies. Native dependencies need a compatible runtime platform and system libraries.

Each `FROM` starts a stage. `COPY --from` selects artifacts from another stage rather than merging its entire filesystem. Because the runtime stage depends on `verify`, building it requires the verification output. A separate test stage that the selected target does not depend on can be skipped by BuildKit; merely writing tests somewhere in a Dockerfile does not ensure they execute.

| Instruction  | Effect                                                                     |
| ------------ | -------------------------------------------------------------------------- |
| `FROM`       | Selects a base and begins a stage.                                         |
| `WORKDIR`    | Sets the working directory for later instructions and the default process. |
| `COPY`       | Copies context files or selected files from another stage.                 |
| `RUN`        | Executes during the build, producing a build result.                       |
| `ENV`        | Records environment defaults that containers can override.                 |
| `USER`       | Sets the user for subsequent instructions and runtime execution.           |
| `EXPOSE`     | Documents an intended container port; it does not publish it on the host.  |
| `CMD`        | Provides a default command or default arguments.                           |
| `ENTRYPOINT` | Provides the executable to which command arguments are normally appended.  |

`RUN node dist/server.js` would start a server **during construction**, usually blocking the build. `CMD` records what should run when a container starts. With `ENTRYPOINT ["node"]` and `CMD ["dist/server.js"]`, runtime arguments replace `CMD` while retaining the entrypoint; `--entrypoint` overrides that executable. An image using only `CMD`, as above, permits a supplied runtime command to replace it completely.

## Build Cache & Reproducibility

BuildKit reuses build results when the instruction and relevant inputs match an available cache entry. Copy dependency manifests before source code so a source-only change need not repeat `npm ci`. Changing a dependency manifest invalidates that dependency step and downstream work that depends on it. Independent stages can still reuse their own cached results.

![Dependency installation cache and a source change triggering verification](/docs/docker/v2/build-stages.svg)

A cache hit does not check whether a remote package repository now offers newer content. An unchanged `RUN` command may reuse its previous result. `--no-cache` forces execution without cached instruction results, while `--pull` checks for updated base images. They address different inputs; neither alone makes an arbitrary network-dependent build reproducible.

A tag such as `node:24-bookworm-slim` can move. A digest identifies fixed image content; a multi-platform index digest can identify a collection whose individual platform manifests differ. Lock dependency versions, control base digests and platform selection, and account for network downloads, timestamps and build tools when reproducibility matters. The same Dockerfile alone is not a guarantee of byte-identical images.

A BuildKit cache mount, such as `RUN --mount=type=cache,target=/root/.npm npm ci`, retains download cache across builds without putting that cache into the resulting layer. It should accelerate a correct build, not contain irreplaceable inputs that the build requires to succeed.

`ARG` provides build-time parameters. It does not automatically become a runtime environment variable unless the Dockerfile records or uses it that way. Neither build arguments nor `ENV` are suitable secret storage: values can become visible in image metadata, history, provenance or produced files. BuildKit secret mounts expose credentials for a particular build step without automatically persisting the mounted secret into the image. The command using the secret can still leak it through logs or generated output.

:::check{question="Only src/server.ts changed. Why can dependency installation stay cached while tests must run again? Does a successful cached build prove the base image is current?"}
The dependency installation depends on the earlier copied package manifests, while source changes invalidate the source-dependent verification step. Cached success only establishes a result for those cached inputs. Updating a base tag requires checking its current resolution, and deliberate refreshes remain separate from source-code changes.
:::

## Processes, Signals & Shutdown

`docker run` creates and starts a container. `docker create` creates one without starting it; `docker start` starts an existing one. A container remains running while its main process runs. A server that launches a background process and then exits can stop the container even if the developer expected that background task to keep it alive.

The main process normally becomes PID 1 inside its process namespace. Signal delivery and child reaping need explicit consideration. The JSON exec form `CMD ["node", "dist/server.js"]` runs Node directly; a shell-form command introduces a shell which may not forward signals to the actual application. An entrypoint script can perform setup and then use `exec` to replace itself with the application. `init: true` adds a small init process to forward signals and reap children; it does not implement application cleanup.

Docker normally sends `SIGTERM` to the main process on stop, waits for the configured timeout, and then uses `SIGKILL` if necessary. An image's stop signal or runtime options can change the first signal. The application must stop accepting new work, finish or abandon in-flight work under a deadline, close dependencies and exit. A forced kill cannot execute JavaScript cleanup handlers.

```ts
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => process.exit(1), 5_000);
  deadline.unref();
  server.close(() => {
    clearTimeout(deadline);
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

This closes the example's HTTP server and bounds shutdown. A real service must also drain queue consumers, manage upgraded connections and close database pools. Its shutdown budget must fit inside the container stop timeout. A successful HTTP response cannot prove that a worker's separately acknowledged task has finished.

Restart policies react to process exit under the policy's rules. A plain Docker container becoming `unhealthy` does **not** automatically trigger an Engine restart. Restarting a broken configuration can produce a loop; inspect its error and exit state instead of treating restart as recovery logic.

## Volumes, Bind Mounts & Temporary Data

A named volume stores data independently of one container and is managed by Docker. A bind mount exposes a specified path from the daemon's host. A tmpfs mount stores temporary data in memory rather than persisting it as container-layer files; it disappears when the container stops and can be affected by host swap configuration.

| Storage        | Appropriate use                                 | Lifecycle or coupling                                   |
| -------------- | ----------------------------------------------- | ------------------------------------------------------- |
| Writable layer | Disposable runtime changes                      | Retained across stop/start; removed with the container. |
| Named volume   | Database files or application data on that host | Retained independently until explicitly removed.        |
| Bind mount     | Local source code or host-managed configuration | Depends on the daemon host's path and permissions.      |
| tmpfs          | Temporary files that need no persistence        | Discarded on stop; consumes memory.                     |

A mount hides existing image content at its destination. Binding an empty host directory over `/app` hides the packaged application; it does not merge the directories. An empty volume can be initialized from pre-existing container content at its destination unless copy-up is disabled. Reusing an existing volume does not refresh its contents from a newly built image.

Mount permissions and UID/GID ownership still apply when the application runs as a non-root user. A read-only root filesystem can coexist with explicitly writable data mounts and tmpfs paths. Restrict writes to those paths rather than change the application back to root when a permission error occurs.

A named volume is not automatically a backup, a remote shared disk or a replicated database. Losing the Docker host can lose its local volumes. Two replicas mounting the same files do not gain transaction coordination; use a database or storage service with the required concurrency model. Backups need a consistent snapshot or application-aware procedure plus a tested restore.

`docker compose down` normally removes the project's containers and networks while retaining named volumes. `down --volumes` also removes project-managed named volumes and attached anonymous volumes. External volumes have a different lifecycle and are not removed by Compose. Choose cleanup scope explicitly; removing a container and deleting its persistent data are separate operations.

## Container Networking & Published Ports

On a user-defined bridge network, containers can resolve peers by their network names or aliases. Compose creates a default project network and service-name discovery. An API connects to `db:5432`, not a hard-coded container IP: recreating `db` can change its address while retaining its service name. Existing TCP connections can still break and require reconnection.

Each ordinary bridge-network container has its own loopback interface. From the API container, `localhost` refers to the API container, not the host and not its database container. The server should listen on `0.0.0.0` to accept connections through its container interfaces; binding only to `127.0.0.1` makes it unreachable from peer containers even if a port is published.

![Host-published API port and service-name traffic inside a Compose network](/docs/docker/v2/network-boundaries.svg)

`-p 127.0.0.1:8080:3000` maps host loopback port 8080 to container port 3000. The application must actually listen on 3000. Omitting the host address normally publishes on all host interfaces, which can expose a development database beyond the machine. Published ports and host firewall behavior must be assessed together; do not assume an application is private just because its process runs in a container.

Containers on the same network can communicate on their listening container ports without publishing them to the host. `EXPOSE` is documentation, not a firewall rule or a required permission for peer traffic. Separate networks reduce connectivity between services, but application authentication and authorization still apply to reachable peers.

`host.docker.internal` is provided by Docker Desktop for reaching host services. On Linux Engine it may require an explicit host-gateway mapping; do not assume it exists everywhere. A remote daemon resolves bind paths and publishes ports on its own host, not on the machine running your CLI.

:::check{question="The host reaches localhost:8080, but a worker container cannot reach the API at localhost:8080. Which address should the worker use?"}
On the same Compose network it should use the service name and container listening port, such as `http://api:8080`. Its own localhost points back to the worker. The host-published port is a different connection boundary; if the API listens internally on 3000, the worker must use `api:3000` instead.
:::

## Compose, Configuration & Readiness

Compose describes services plus their networks, volumes and runtime settings. `docker compose up` creates or recreates resources to match that model. `docker compose restart` restarts existing containers without applying a changed image or changed environment configuration. Compose is not a multi-host scheduler and does not provide an automated production rollout strategy merely because several services share a file.

```yaml
services:
  api:
    build: .
    ports:
      - '127.0.0.1:8080:8080'
    environment:
      PORT: '8080'
      DATA_DIR: /data
    volumes:
      - notes:/data
    read_only: true
    tmpfs:
      - /tmp
    init: true
    stop_grace_period: 10s
    healthcheck:
      test: ['CMD', 'node', 'dist/healthcheck.js']
      interval: 3s
      timeout: 2s
      retries: 5
      start_period: 3s
  probe:
    build: .
    command: ['node', 'dist/probe.js']
    environment:
      API_URL: http://api:8080
    depends_on:
      api:
        condition: service_healthy
volumes:
  notes:
```

The API checks `/readyz`; the probe starts after that check succeeds and calls the API through service-name DNS. Healthcheck commands execute **inside** the container, so their executable and script must exist in the runtime image. Installing `curl` on the host does not make it available inside a minimal image.

A running process is not necessarily ready. The example separates `/healthz`, which confirms its HTTP loop responds, from `/readyz`, which checks the configured data directory is writable. A database-backed readiness check needs an appropriate dependency check instead. Healthcheck retries and startup grace prevent a slow startup from being treated like repeated steady-state failures, but an overly permissive check can still report a broken service as healthy.

`depends_on` without a health condition primarily orders startup; it does not establish database readiness. Even a health-gated dependency can fail later. Applications need reconnection, bounded retries and suitable error responses after startup. A one-shot migration can use `service_completed_successfully`; parallel application replicas must not independently race the same migration.

Compose interpolation and container environment are different stages. A project `.env` file can supply `${VARIABLE}` values while Compose resolves its model, but that does not inject every `.env` entry into every container. Service `environment` and `env_file` set container values; runtime values can override image defaults. The resolved `docker compose config` output helps inspect this distinction, but can also display secrets supplied through configuration.

Runtime Compose secrets are mounted as files for explicitly permitted services. They avoid baking a secret into an image, but local secret files still need protection and the application must support reading them. They are not equivalent to deploying a managed secret vault. Recreating a container with changed credentials does not itself rotate the credential at its external provider.

:::check{question="A dependency passes its healthcheck, the API starts, then the dependency fails. Will depends_on repair the running API or guarantee future requests succeed?"}
No. The condition gates startup, not every later request. The API needs runtime failure handling and reconnection. Its readiness may become false, but traffic removal or replacement requires a component that acts on that state; a plain Engine healthcheck alone does not provide that policy.
:::

## Resource Limits & Security Boundaries

Containers do not receive isolated hardware merely because their process IDs differ. Without explicit resource constraints, they can compete for the host's available CPU and memory. Docker Desktop's VM limits form an additional enclosing budget.

A memory limit can cause an allocation failure or an OOM kill; an exit code of 137 indicates a `SIGKILL` termination convention, not proof that the kernel's OOM killer caused it. Inspect `State.OOMKilled`, logs and host metrics. A CPU quota limits available CPU time and can increase latency under load; CPU shares are a relative scheduling weight under contention, not a guaranteed number of cores.

The example Compose file sets `mem_limit`, `cpus` and `pids_limit`. Node's heap is only part of process memory: buffers, native allocations, stacks and other processes also count. A JavaScript heap flag does not replace a container memory budget. A PID limit bounds processes/threads but must leave room for the runtime and healthchecks.

Running as `USER node` reduces privileges inside the container. It is different from rootless Docker, which runs the daemon and containers without host root privileges. Drop unneeded capabilities, avoid privileged mode, apply the runtime's security profiles and keep host/kernel and image dependencies patched. Container isolation is not an unconditional boundary for executing arbitrary hostile code.

Access to a rootful Docker daemon socket can grant control over the host through container creation and host mounts. Mounting that socket into an application is a separate security decision, not an ordinary way to enable logging or image inspection. A non-root application user does not neutralize broad daemon access.

## Registries, Platforms & Deployment Artifacts

A registry stores image manifests and content blobs. A repository groups image versions, tags name references, and digests identify content. `latest` is a conventional tag, not a promise of the newest tested release. Retagging an image does not rebuild its filesystem; pushing it does not modify already running containers.

Build once, test and scan the artifact, push it, then deploy its chosen digest. Scan results apply to known findings at a point in time; digest pinning preserves identity but also preserves vulnerabilities until a replacement is deliberately built and deployed. Record provenance and sign/verify artifacts under the deployment's trust policy when supply-chain requirements call for it.

A multi-platform image index selects a manifest matching the target operating system and architecture. Emulation can run or build a different architecture, often with different performance; a successful emulated build does not replace testing on the intended deployment platform. Cross-compilation and native build nodes are alternative strategies, each with its own dependency constraints.

Pushing a source repository or running `docker commit` on a manually changed container is not a replacement for a reviewed build definition. `docker commit` also does not include data stored in mounted volumes. Keep runtime data and credentials outside the distributable artifact.

## Logs, Diagnosis & Cleanup

Applications should normally write operational logs to stdout/stderr so the configured logging driver can collect them. `docker logs` availability depends on that driver and its configuration. Set retention or rotation: unbounded logs, image layers, caches and volumes all compete for host disk, even when the application's writable layer is small.

| Symptom                               | First evidence                                              | Boundary to examine                                                             |
| ------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Container exits immediately           | `docker ps -a`, `docker logs`, inspect exit state           | Main command, configuration, permissions or crash.                              |
| Host port cannot connect              | `docker port`, app bind address, inspect networks           | Host publication versus actual listening container port.                        |
| API cannot connect to database        | Service DNS, network membership, dependency logs            | Container localhost, readiness, credentials and reconnect logic.                |
| Data disappears after replacement     | `docker inspect` mounts and write path                      | Writable layer versus mounted storage.                                          |
| Healthy process still serves failures | Probe output and application errors                         | Probe scope versus business/dependency readiness.                               |
| Disk usage keeps growing              | `docker system df`, logging configuration, volume inventory | Images, build cache, runtime logs and persistent data have separate lifecycles. |

`docker exec` starts another process inside a running container; it does not replace the main process. Minimal images may lack a shell or diagnostic utilities. Inspect exit status, health output, mounts and configuration before changing the container interactively. A manual patch disappears on replacement and hides the missing change in source or deployment configuration.

Use resource-specific cleanup and project ownership rather than broad prune commands as a routine fix. Removing an unused image does not delete a named volume, and removing application containers does not clear the build cache. Destructive volume cleanup needs a separate decision from replacing a disposable service.

[Executable example and setup instructions](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/docker-reading/examples/docker-reading)
