---
title: REST Deep Dive
description: Deep dive into REST architectural constraints, resources, representations, uniform interfaces, hypermedia, state transitions, and resource-oriented interactions.
icon: rest.png
order: 2
updatedAt: 2026-08-21
---

# Client-Server

REST separates client concerns from server concerns through a defined interface.

Clients own concerns such as presentation and user interaction, while servers own resources, application behavior, and persistence. Neither side needs to share the other's implementation.

This boundary allows client and server implementations to evolve independently as long as the interface between them remains compatible.

![REST Client-Server Separation](/docs/rest/rest-client-server-separation.png)

---

# Statelessness

REST requires each request to contain the information necessary for the server to understand and process it.

The server must not depend on client session context retained from previous requests to interpret the current request.

Statelessness does not mean that the server cannot maintain state. **Resource state** belongs to the server and can persist between requests. What is removed is the requirement for server-side session context that tracks a client's interaction history.

![REST Statelessness](/docs/rest/rest-statelessness.png)

---

# Cacheability

REST requires responses to define whether their data can be reused by a client or intermediary.

A cacheable response allows equivalent interactions to be satisfied without contacting the origin server again, while a non-cacheable response prevents reuse where fresh processing is required.

Caching semantics form part of the interface because consumers must be able to determine when a previously received representation remains reusable.

---

# Uniform Interface

The Uniform Interface constraint establishes a common interaction model between REST components.

Instead of exposing a different communication mechanism for each capability, REST standardizes interaction around resources and representations. This decouples clients from the implementations that manage those resources.

Uniform Interface is composed of four constraints.

![REST Uniform Interface](/docs/rest/rest-uniform-interface.png)

## Resource Identification

Each resource must be identifiable through the interface independently of its internal representation or storage.

The identifier refers to the conceptual resource, not to a database row, file, object instance, or other implementation detail.

A resource can therefore retain the same identity while its representation or internal implementation changes.

## Resource Manipulation Through Representations

Clients interact with resources by transferring representations that describe resource state.

A representation provides the information needed to express or obtain a desired state without requiring access to the implementation that manages the resource.

The representation and the resource are separate concepts: the same resource can be represented differently without changing its identity.

## Self-Descriptive Messages

Each message must contain enough information for a recipient to understand how to process it.

Interpretation should come from the message itself and the shared interface semantics rather than undocumented knowledge about the server implementation or previous interactions.

This allows clients, servers, and intermediaries to interpret messages without requiring direct knowledge of one another.

## Hypermedia as the Engine of Application State

HATEOAS allows representations to expose links and available actions that describe valid transitions from the client's current application state.

A client can discover possible next interactions from representations instead of constructing every transition from out-of-band knowledge.

The available transitions can change with resource state. A representation of a pending order, for example, may expose different actions from the representation of a completed order.

![REST HATEOAS](/docs/rest/rest-hateoas.png)

---

# Resource Representations

A **resource** is the conceptual target of an interaction. A **representation** is a transferable description of that resource's current or intended state.

The same resource may have multiple representations without changing its identity.

Representations also remain independent of the server's persistence model. An API representation does not need to mirror database schemas, internal entities, or domain objects.

![REST Resource Representations](/docs/rest/rest-resource-representation.png)

---

# Layered System

REST allows components to be organized into hierarchical layers.

A client interacts with the component immediately responsible for the interface without needing to know whether that component is the origin server or an intermediary.

Intermediaries can therefore participate in communication without changing the client-facing interface.

This permits infrastructure and application topology to evolve behind the same REST interface.

![REST Layered System](/docs/rest/rest-layered-system.png)

---

# Code-on-Demand

Code-on-Demand allows a server to extend client functionality by transferring executable code.

Unlike the other REST constraints, Code-on-Demand is optional. A system can conform to REST without using it.

When present, it temporarily moves part of the application behavior from the server to code executed by the client.

---

# Resource-Oriented URI Design

Resource identifiers should identify resources rather than encode implementation procedures.

Collections, individual resources, and relationships can each receive stable identifiers while remaining independent of the operations performed against them.

This keeps resource identity separate from interaction semantics and avoids modeling the interface as a collection of remote procedure names.

![REST Resource-Oriented URI Design](/docs/rest/rest-resource-uri-design.png)

---

# Representation Design

Representations expose the state and relationships that consumers need without requiring the internal resource model to be transferred directly.

A representation may include resource data, relationships to other resources, metadata, and hypermedia controls when those elements belong to the external interface.

The representation should remain an API contract rather than becoming a serialized copy of persistence or implementation structures.

![REST Representation Design](/docs/rest/rest-representation-design.png)

---

# Application State Transitions

REST distinguishes **resource state** from **application state**.

Resource state describes the current state of resources managed by the server.

Application state describes where the client currently is in its interaction with the application and which transitions are available from that point.

Representations transfer information about resources and can expose transitions that allow the client to move to another application state.

This transfer of representations between application states is central to the meaning of **Representational State Transfer**.

![REST Application State Transitions](/docs/rest/rest-application-state.png)

---

# Resource-Oriented Interactions

REST models interactions around resources rather than exposing server procedures as the primary interface.

An identifier should answer **which resource** is being addressed. The interaction semantics determine what is being requested of that resource.

Encoding operations directly into identifiers couples the interface to procedure names and moves the design toward an RPC-style model.

Resource-oriented interfaces preserve stable resource identities while allowing standardized interaction semantics to operate over them.

![REST Resource-Oriented Interactions](/docs/rest/rest-resource-interactions.png)

---

# Putting Everything Together

A REST interaction combines resource identity, representations, application state, and a uniform interface under the architectural constraints defined by REST.

![REST Complete Model](/docs/rest/rest-complete-model.png)
