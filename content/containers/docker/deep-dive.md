---
title: Docker Deep Dive
description: Master the engineering concepts that explain how Docker uses operating system features to create lightweight, isolated, and portable execution environments.
order: 2
updatedAt: 2026-07-05
---

# Docker Deep Dive

## Operating System

An **Operating System (OS)** is the software responsible for managing a computer's hardware resources and providing services to running applications.

Applications do not communicate directly with the CPU, memory, storage, or network devices.

Instead, they interact with the Operating System, which coordinates access to these resources.

The Operating System is responsible for:

- Process management.
- Memory management.
- File systems.
- Networking.
- Device management.
- Security and permissions.

Docker relies heavily on operating system features rather than replacing the operating system itself.

:::at-a-glance

### Operating System Responsibilities

- Manage hardware.
- Schedule processes.
- Allocate memory.
- Provide networking.
- Manage files.
- Enforce isolation.

:::

:::misconceptions

❌ Docker replaces the Operating System.

✅ Docker runs on top of an Operating System and depends on many of its kernel features.

:::

---

## Processes

A **Process** is a running instance of a program.

Every application executed on an operating system runs as one or more processes.

Each process receives its own:

- Virtual memory.
- Process identifier (PID).
- Execution state.
- Open file descriptors.
- Network connections.

The Operating System schedules processes independently, allowing many applications to execute concurrently.

Containers do not execute applications in a special way.

A container simply runs one or more ordinary operating system processes inside an isolated environment.

:::at-a-glance

### Every Process Has

- PID
- Memory space
- Threads
- File descriptors
- Execution state

:::

:::misconceptions

❌ A Docker Container is a virtual machine.

✅ A Docker Container is primarily one or more isolated operating system processes.

:::

:::example

Running:

```bash
node server.js
```

creates a normal operating system process.

Running:

```bash
docker run my-api
```

also creates a normal operating system process.

The difference is that Docker isolates that process.

:::

---

## Virtual Machines

Before containers became popular, applications were commonly isolated using **Virtual Machines (VMs).**

A Virtual Machine emulates an entire computer.

Each VM includes:

- Virtual hardware.
- A complete Guest Operating System.
- System services.
- Applications.

Because every VM contains its own operating system, virtual machines consume significantly more CPU, memory, and storage than containers.

However, they provide very strong isolation because each VM runs an independent operating system.

:::at-a-glance

### Virtual Machine

- Virtual hardware.
- Guest Operating System.
- Strong isolation.
- Higher resource usage.

:::

:::misconceptions

❌ Containers are lightweight virtual machines.

✅ Containers share the host kernel, while virtual machines run independent operating systems.

:::

---

## Containers

A **Container** is an isolated execution environment for one or more operating system processes.

Unlike a Virtual Machine, a container does not include its own operating system kernel.

Instead, containers share the host kernel while remaining isolated from other containers through operating system features such as namespaces and cgroups.

Because containers reuse the host kernel instead of virtualizing an entire operating system, they start almost instantly and consume significantly fewer resources than virtual machines.

From the application's perspective, the container behaves as though it has its own filesystem, network interfaces, process tree, and users.

In reality, these resources are isolated views provided by the host operating system.

:::at-a-glance

### Containers

- Isolated processes.
- Share the host kernel.
- Lightweight.
- Portable.
- Fast startup.

:::

:::misconceptions

❌ A container contains an entire operating system.

✅ A container shares the host operating system kernel.

---

❌ Containers provide isolation by emulating hardware.

✅ Containers rely on operating system isolation mechanisms.

:::

:::example

Inside a container:

```bash
ps
```

may show:

```text
PID  COMMAND

1    node server.js
```

Although the host machine may be running hundreds of other processes, the container sees only its own isolated process tree.

:::

---

## Docker

Docker is the platform responsible for creating, managing, and executing containers.

Rather than implementing isolation itself, Docker orchestrates operating system features and provides a developer-friendly interface for building, distributing, and running containers.

Docker automates tasks such as:

- Building images.
- Creating containers.
- Managing networks.
- Mounting volumes.
- Downloading images.
- Starting and stopping containers.

Without Docker, developers would need to manually configure the underlying operating system features required for containerization.

:::at-a-glance

### Docker Responsibilities

- Build images.
- Run containers.
- Manage networking.
- Manage storage.
- Distribute images.

:::

:::misconceptions

❌ Docker and containers are the same thing.

✅ Docker is one platform for working with containers.

Containers can also be managed by technologies such as containerd, CRI-O, or Podman.

:::

---

## Images

A **Docker Image** is an immutable template used to create containers.

Images contain everything required to start an application, including:

- Application code.
- Runtime.
- Libraries.
- Dependencies.
- Configuration.
- Filesystem.

Every container begins from an image.

Multiple containers can be created from the same image without modifying the image itself.

Because images never change after being built, they provide reproducible and predictable deployments.

:::at-a-glance

### Images

- Immutable.
- Reusable.
- Portable.
- Versioned.

:::

:::misconceptions

❌ Containers and Images are interchangeable.

✅ Images are templates.

Containers are running instances created from those templates.

:::

:::example

```bash
docker run nginx
```

Execution flow:

```text
Docker Image

↓

Container

↓

Running Process
```

:::

---

## Layers

Docker Images are composed of multiple **Layers**.

Each instruction in a Dockerfile typically creates a new immutable layer.

Rather than rebuilding an entire image after every change, Docker reuses unchanged layers.

Layer reuse significantly improves build performance while reducing storage requirements.

Because layers are immutable, multiple images can safely share the same underlying data.

:::at-a-glance

### Benefits

- Faster builds.
- Shared storage.
- Immutable filesystem.
- Efficient caching.

:::

:::misconceptions

❌ Docker rebuilds every image from scratch.

✅ Docker reuses unchanged layers whenever possible.

:::

:::example

```Dockerfile
FROM node:22

WORKDIR /app

COPY package.json .

RUN npm install

COPY . .

RUN npm run build
```

If only the application source code changes:

```Dockerfile
COPY . .
```

and

```Docker
RUN npm run build
```

need to be rebuilt.

The previous layers remain cached.

:::

---

## Container Lifecycle

A **Container** has a lifecycle that begins when it is created and ends when it is removed.

Unlike Virtual Machines, containers are designed to be ephemeral.

Rather than modifying running containers, modern containerized applications typically replace old containers with new ones built from updated images.

This immutable deployment model improves consistency, reproducibility, and rollback capabilities.

The typical lifecycle is:

```text
Image

↓

Container Created

↓

Container Started

↓

Running

↓

Stopped

↓

Removed
```

A container may be started and stopped multiple times without being recreated, but once removed, its writable layer is lost unless persistent storage is used.

:::at-a-glance

### Lifecycle

- Create
- Start
- Run
- Stop
- Remove

:::

:::misconceptions

❌ Containers are long-lived servers.

✅ Containers are generally disposable execution environments.

:::

---

## Volumes

Containers are designed to be ephemeral.

When a container is removed, its writable filesystem is removed as well.

A **Volume** provides persistent storage that exists independently of any individual container.

Volumes allow applications to preserve important data such as:

- Databases
- Uploaded files
- Logs
- Configuration
- Shared application data

Because volumes are managed independently, containers can be replaced without losing persistent data.

:::at-a-glance

### Volumes

- Persistent storage.
- Independent of containers.
- Reusable.
- Managed by Docker.

:::

:::misconceptions

❌ Container storage survives container deletion.

✅ Only external volumes survive container removal.

:::

:::example

```text
Container A
      │
      ▼
 Volume
      ▲
      │
Container B
```

Both containers can access the same persistent storage.

:::

---

## Networks

Containers communicate through Docker Networks.

Rather than exposing every container directly to the host operating system, Docker creates isolated virtual networks that allow containers to communicate securely.

Containers connected to the same network can communicate using their container names as hostnames.

Docker provides several network drivers, including:

- Bridge
- Host
- Overlay
- None

The Bridge network is the default choice for most local applications.

:::at-a-glance

### Benefits

- Container discovery.
- Isolation.
- Internal communication.
- Flexible topologies.

:::

:::misconceptions

❌ Containers automatically communicate with every other container.

✅ Containers communicate only through configured Docker networks.

:::

:::example

```text
Frontend
      │
      ▼
Docker Network
      ▲
      │
Backend
      │
      ▼
Database
```

The database remains inaccessible from outside the network.

:::

---

## Dockerfile

A **Dockerfile** is a declarative specification describing how a Docker Image should be built.

Rather than manually configuring environments, developers define every build step inside the Dockerfile.

Because Dockerfiles are version-controlled alongside the application source code, every image can be reproduced consistently.

Common instructions include:

- FROM
- WORKDIR
- COPY
- RUN
- ENV
- EXPOSE
- CMD
- ENTRYPOINT

:::at-a-glance

### Dockerfile

Defines:

- Base image.
- Dependencies.
- Files.
- Environment.
- Startup command.

:::

:::misconceptions

❌ Dockerfiles execute applications.

✅ Dockerfiles define how images are built.

:::

:::example

```Dockerfile
FROM node:22

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

CMD ["npm", "start"]
```

:::

---

## Build Context

The **Build Context** is the collection of files Docker can access while building an image.

When a build starts, Docker sends the Build Context to the Docker Engine.

Every `COPY` and `ADD` instruction can only reference files contained within that context.

Reducing the Build Context improves build performance because fewer files need to be transferred during every build.

Files that are not required should be excluded using `.dockerignore`.

:::at-a-glance

### Build Context

- Files available during build.
- Used by `COPY` and `ADD`.
- Impacts build performance.
- Controlled by `.dockerignore`.

:::

:::misconceptions

❌ Docker can copy any file from the host machine.

✅ Docker can only access files included in the Build Context.

:::

:::example

```text
Project/

├── Dockerfile
├── package.json
├── src/
└── .dockerignore
```

Everything inside this directory becomes available during the image build.

:::

---

## Image Registry

An **Image Registry** stores Docker Images so they can be shared and deployed across different environments.

Instead of building images separately on every machine, developers build an image once and publish it to a registry.

Other environments download exactly the same immutable image.

Common registries include:

- Docker Hub
- GitHub Container Registry
- Amazon ECR
- Google Artifact Registry
- Azure Container Registry

Image registries make deployments reproducible because every environment executes the exact same image.

:::at-a-glance

### Registry Responsibilities

- Store images.
- Version images.
- Share images.
- Distribute deployments.

:::

:::misconceptions

❌ Registries store running containers.

✅ Registries store immutable Docker Images.

:::

:::example

```text
Developer

↓

Build Image

↓

Push

↓

Image Registry

↓

Pull

↓

Production
```

:::

---

## Docker Compose

Docker Compose defines multi-container applications.

Rather than manually starting each container, network, and volume individually, Docker Compose describes the complete application using a single declarative configuration.

Compose commonly manages:

- Multiple containers.
- Networks.
- Volumes.
- Environment variables.
- Startup dependencies.

It is primarily intended for local development and testing environments.

:::at-a-glance

### Docker Compose

- Multi-container applications.
- Declarative configuration.
- Local development.
- Repeatable environments.

:::

:::misconceptions

❌ Docker Compose replaces Kubernetes.

✅ Docker Compose simplifies local orchestration. Kubernetes manages production-scale container orchestration.

:::

:::example

```text
compose.yaml

↓

Frontend

↓

Backend

↓

PostgreSQL

↓

Redis
```

All components start together using a single configuration.

:::

---

## Multi-stage Builds

A **Multi-stage Build** allows a Docker Image to be built using multiple independent build stages.

Earlier stages compile, test, or package the application.

The final stage copies only the artifacts required at runtime.

This approach produces significantly smaller, more secure images because build tools and temporary files are excluded from the final image.

Multi-stage builds are considered a best practice for production deployments.

:::at-a-glance

### Benefits

- Smaller images.
- Faster deployments.
- Better security.
- Reduced attack surface.

:::

:::misconceptions

❌ Every build stage becomes part of the final image.

✅ Only the explicitly copied artifacts are included in the final stage.

:::

:::example

```Dockerfile
FROM node:22 AS builder

RUN npm install
RUN npm run build

FROM nginx:latest

COPY --from=builder /app/dist /usr/share/nginx/html
```

The final image contains only the compiled application, not the Node.js build environment.

:::

---

# Putting Everything Together

The following sequence summarizes how Docker packages, distributes, and executes an application.

```text
                Developer
                     │
                     ▼
               Application Code
                     │
                     ▼
                Dockerfile
                     │
                     ▼
              Docker Build
                     │
                     ▼
               Docker Image
                     │
              Push / Pull
                     ▼
             Image Registry
                     │
                     ▼
              Docker Engine
                     │
                     ▼
          Create Container
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
     Volumes     Networks     Processes
        │            │            │
        └────────────┼────────────┘
                     ▼
          Running Application
```

The development process begins when a developer defines the application's execution environment using a Dockerfile.

Docker builds an immutable image by executing each instruction and storing the resulting filesystem as a sequence of reusable layers.

Once built, the image can be stored in an Image Registry, allowing the exact same artifact to be distributed across different environments.

Whenever the image is executed, Docker creates a new container.

The container runs one or more isolated operating system processes while sharing the host operating system kernel.

If the application requires persistent data, Docker mounts one or more Volumes.

If the application communicates with other containers, Docker connects them through Docker Networks.

Because every container originates from the same immutable image, applications execute consistently regardless of the underlying machine.

---

## Final Perspective

Docker is not a virtual machine.

Docker is not an operating system.

Docker is a container platform that packages applications into portable, reproducible execution environments.

By combining immutable images, isolated containers, persistent storage, virtual networking, and reproducible builds, Docker eliminates many of the inconsistencies traditionally associated with software deployment.

Understanding containers as isolated operating system processes—and understanding Docker as the platform that manages those processes—is far more valuable than memorizing Docker commands.

These concepts form the foundation of modern cloud-native software, continuous delivery pipelines, and container orchestration platforms such as Kubernetes.
