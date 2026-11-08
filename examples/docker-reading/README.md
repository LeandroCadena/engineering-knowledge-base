# Docker reading example

A dependency-free Node.js HTTP application compiled from TypeScript. Its endpoints distinguish process liveness, storage readiness and data read from an external path. The runtime image contains compiled code, runs as the Node image's non-root user and accepts signals directly through exec-form CMD. Compose adds an init process, resource limits, a writable volume, a read-only root filesystem and a health-gated peer probe.

The example uses Linux containers, Node 24, BuildKit and the Compose plugin (`docker compose`). The base tag `node:24-bookworm-slim` is deliberately readable but mutable: pin its resolved digest under your release policy. The lockfile pins npm dependencies; it does not pin the base image or all build inputs.

## Application checks without Docker

```sh
npm ci
npm test
```

Four tests compile and run actual Node processes: HTTP/data behavior; unavailable storage versus live process; SIGTERM cleanup; invalid configuration exit. They do **not** prove container networking, filesystem isolation, volume lifecycle or image construction.

## Container checks

Requires a reachable **local Linux-container Docker daemon**, BuildKit, the Compose plugin and a free host port 8080. The host-side HTTP assertion assumes the daemon publishes on this machine. A remote daemon needs a different host endpoint; `localhost` on the CLI machine would not identify it.

```sh
npm run test:containers
```

This builds the image (including its application tests), checks the resolved Compose model, starts a randomly named project, then checks:

- API publication on host loopback and successful host HTTP access.
- Healthy readiness and peer service-name DNS through a one-shot probe.
- Non-root UID 1000 and the configured read-only root filesystem.
- A file written by the non-root process into the named volume surviving removal/recreation of the API container.
- Graceful stop with exit code 0 and the application's cleanup log.

The runner's `finally` removes only its own random project's containers, networks, volumes and locally tagged images. It **deletes that test volume** and its note. BuildKit caches may remain. Do not use this cleanup command against a project whose data you want to retain.

Validation in the authoring environment: application tests, TypeScript compilation and standalone Compose 5.7.0 model validation were run. No Docker daemon/socket is available, so image build and container checks were **not executed here**. The integration runner fails if the daemon is unavailable; it does not turn skipped execution into a pass.

## Manual observation

From this directory, with Docker available:

```sh
docker compose config
docker compose build
docker compose up -d --wait api
docker compose run --rm --no-deps probe
curl http://127.0.0.1:8080/identity
docker compose exec api node -e "require('node:fs').writeFileSync('/data/note.txt','saved')"
curl http://127.0.0.1:8080/note
docker compose up -d --force-recreate --wait api
curl http://127.0.0.1:8080/note
docker compose stop api
docker compose logs api
docker compose down
```

`down` retains the named volume; add `--volumes` only to discard the example's data. The application does not create or migrate persistent schemas. It has no authentication, public write API, database or business transaction model. `/identity` is diagnostic only. Storage readiness checks directory permissions, not disk capacity, fsync durability or a database transaction. The signal test proves normal idle shutdown, not every long-running HTTP/queue/WebSocket draining scenario.

The `probe` service uses the same build as the API, and overrides CMD. It is one-shot, so it is started with `compose run`; `compose up --wait api` deliberately selects the long-running service. Root filesystem restrictions apply to `api`; a shared image does not imply shared runtime restrictions.

## Primary references

- [Docker Engine and containers](https://docs.docker.com/engine/containers/run/)
- [Dockerfile reference](https://docs.docker.com/reference/dockerfile/)
- [Multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
- [Build cache invalidation](https://docs.docker.com/build/cache/invalidation/)
- [Build secrets](https://docs.docker.com/build/building/secrets/)
- [Volumes](https://docs.docker.com/engine/storage/volumes/) and [storage types](https://docs.docker.com/engine/storage/)
- [Container networking](https://docs.docker.com/engine/network/)
- [Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/)
- [Compose interpolation](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)
- [Resource constraints](https://docs.docker.com/engine/containers/resource_constraints/)
- [Restart policies](https://docs.docker.com/engine/containers/start-containers-automatically/)
- [Engine security](https://docs.docker.com/engine/security/)
- [Multi-platform builds](https://docs.docker.com/build/building/multi-platform/)

Three app-owned SVG diagrams are maintained in `public/docs/docker/v2`; previous PNG assets and split documents remain archived for comparison. The reading's active entry is `reading.md`.
