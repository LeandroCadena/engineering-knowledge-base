---
title: API Keys Overview
description: Understand what API Keys are, how they associate requests with clients or projects, and where they fit within API access and security.
order: 1
updatedAt: 2026-08-10
---

# API Keys

## Definition

An **API Key** is a credential issued by an API provider and associated with a known client, application, project, integration, or other usage context.

When a request presents a valid key, the provider can associate that request with the context represented by the credential and apply the corresponding access rules, quotas, usage tracking, or billing policies.

API Keys commonly act as secret credentials, meaning possession may be sufficient to use them. Some systems also provide publishable or restricted keys intended for environments where the credential cannot remain confidential.

An API Key does not identify an end user unless a particular system explicitly assigns that meaning to it, and it does not provide encryption or protect the communication channel.

---

## How It Works

API Keys establish a credential relationship between a provider and a client. The provider controls which context and policies are associated with each issued key.

![API Key High-Level Flow](/docs/api-keys/api-keys-overview-flow.png)

A key can therefore serve as more than a binary access check. Its associated context can determine which APIs are available, how usage is measured, and which restrictions apply to requests presenting that credential.

---

## How It Fits into the Ecosystem

API Keys operate at the API access layer, where requests need to be associated with a known client or usage context.

They can be used independently for simple access models or alongside mechanisms that provide different security properties.

![API Key Ecosystem](/docs/api-keys/api-keys-overview-ecosystem.png)

The role assigned to an API Key depends on the system using it. In one API it may authenticate a confidential client, while in another it may primarily identify a project for quota enforcement or usage attribution.

---

## What It Looks Like

API providers define how clients supply their keys. The credential may appear in an HTTP header or another provider-defined request location, and keys often use recognizable prefixes or formats to distinguish their purpose or environment.

![API Key Request](/docs/api-keys/api-keys-overview-request.png)

The transport format does not determine the key's security properties. Whether a key must remain secret, where it may be used, and which restrictions apply are defined by the provider that issued it.

---

## Common Use Cases

### Third-Party API Access

Applications can use API Keys to access external services under credentials issued specifically for that integration.

### Project or Application Identification

Providers can associate requests with a particular project or application for configuration, policy enforcement, and operational visibility.

### Internal Service Integrations

Services operating within a controlled environment can use API Keys as credentials for integrations that require a simple shared access model.

### Usage Metering and Quotas

A provider can associate API consumption with a key to measure usage, enforce rate or quota limits, and attribute consumption to the corresponding client or project.

### Restricted Client Access

Keys intended for environments where confidentiality cannot be guaranteed can be constrained by provider-defined restrictions that limit where or how they may be used.
