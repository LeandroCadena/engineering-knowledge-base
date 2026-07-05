---
title: Apache Kafka Overview
description: Understand why event streaming platforms exist, how Kafka stores immutable event logs, and how distributed systems process events at massive scale.
order: 1
updatedAt: 2026-07-05
---

# Apache Kafka

## Definition

Apache Kafka is a distributed event streaming platform designed to publish, store, and process continuous streams of events.

Unlike traditional message queues, Kafka does not focus on executing background tasks.

Instead, Kafka stores events as an immutable log that multiple independent consumers can read at their own pace.

This enables systems to process, replay, and analyze the same events without interfering with one another.

Kafka is commonly used for:

- Event-driven architectures.
- Audit logs.
- Real-time analytics.
- Change Data Capture (CDC).
- Microservices.
- Data pipelines.
- Stream processing.

Rather than asking "Who should process this message?", Kafka asks:

> "Who wants to consume this event?"

---

## How it Works

Applications publish events to Kafka Topics.

Kafka stores those events durably.

Consumers independently read events using their own offsets.

```text
Producer

↓

Topic

↓

Kafka Log

↓

Consumer A

Consumer B

Consumer C
```

Unlike traditional queues, events remain available after they have been consumed.

Each consumer decides independently how far it has progressed through the event log.

---

## Why Event Streaming Exists

Many modern systems require the same event to be processed by multiple independent services.

For example:

An order is created.

At the same time:

- Billing must charge the customer.
- Inventory must reserve stock.
- Analytics must record the sale.
- Notifications must send an email.
- Fraud detection must evaluate the transaction.

With a traditional queue, only one consumer receives the message.

With Kafka, every interested service can consume the same event independently.

```text
Order Created

↓

Kafka

↓

Billing

Inventory

Analytics

Notifications

Fraud Detection
```

Because events remain stored, new services can begin consuming historical events without affecting existing consumers.

---

## How it Fits into the Ecosystem

Kafka acts as the central event backbone of a distributed system.

Instead of services communicating directly with one another, they publish events to Kafka.

Any interested service can consume those events independently.

```text
Service A
      │
      ▼
Kafka Topic
      │
 ┌────┼────┬─────┐
 ▼    ▼    ▼     ▼
Billing Analytics Search Notifications
```

Kafka commonly works together with:

- PostgreSQL
- Redis
- Microservices
- Data Warehouses
- Stream Processing Engines
- Analytics Platforms
- Event-Driven Architectures

Rather than coordinating work like a traditional message queue, Kafka becomes the shared source of business events across the organization.

---

## Real-World Usage

Kafka is commonly used whenever multiple systems need to consume the same stream of events.

Typical examples include:

- Financial transaction processing.
- User activity tracking.
- IoT telemetry.
- Fraud detection.
- Clickstream analytics.
- Inventory synchronization.
- Audit logging.
- Change Data Capture (CDC).

Large organizations often process millions of events per second using Kafka clusters.

---

## Practical Examples

### Example 1 — E-commerce

A customer places an order.

The application publishes an **Order Created** event.

Multiple independent services consume that event:

- Billing
- Inventory
- Shipping
- Analytics
- Notifications

Each service processes the event independently without affecting the others.

---

### Example 2 — Banking

Every financial transaction is published as an immutable event.

Compliance, fraud detection, customer notifications, and reporting systems all consume the same event stream independently.

---

### Example 3 — IoT Platform

Thousands of connected devices continuously publish telemetry.

Kafka stores every event.

Analytics systems, monitoring platforms, dashboards, and machine learning pipelines consume the same event stream at different speeds.

---

## What's Next?

This overview introduced Kafka as a distributed event streaming platform built around immutable event logs rather than traditional message queues.

The Kafka Deep Dive explores topics, partitions, offsets, consumer groups, retention, replay, ordering guarantees, performance, and production best practices for building scalable event-driven systems.
