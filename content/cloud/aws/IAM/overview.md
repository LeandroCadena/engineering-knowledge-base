---
title: IAM Overview
description: Understand what AWS Identity and Access Management (IAM) is, why it exists, and how it securely controls access to AWS resources through identities, policies, and permissions.
order: 1
updatedAt: 2026-07-09
---

# IAM

## Definition

AWS Identity and Access Management (IAM) is the authorization system used to control access to AWS resources.

Rather than granting unrestricted access to cloud infrastructure, IAM allows organizations to define who can perform specific actions on specific resources under specific conditions.

IAM provides centralized access control across AWS services while following the Principle of Least Privilege.

---

## How it Works

Every request made to AWS is evaluated before it is allowed to execute.

IAM determines:

- Who is making the request.
- Which action is being requested.
- Which resource is being accessed.
- Whether the request should be allowed or denied.

```text
AWS Request

↓

Identity

↓

Policies

↓

Permission Evaluation

↓

Allow

or

Deny
```

IAM itself does not execute AWS services.

Its responsibility is deciding whether a request is authorized to proceed.

---

## How it Fits into the Ecosystem

```text
Application

↓

IAM Identity

↓

IAM Authorization

↓

AWS Service

↓

Resource
```

Nearly every AWS service relies on IAM before executing operations.

Examples include:

- Lambda
- S3
- SQS
- ECS
- DynamoDB
- CloudWatch
- Secrets Manager

Rather than implementing authorization independently, AWS services delegate authorization decisions to IAM.

---

## Real-World Usage

IAM is used to control access for:

- Developers.
- Applications.
- AWS services.
- CI/CD pipelines.
- Serverless functions.
- Containers.
- Cross-account integrations.

Without IAM, every AWS identity would effectively have administrator privileges, making secure cloud environments impossible.

---

## Practical Examples

### Example 1 — Lambda Accessing S3

A Lambda function needs to upload files to an S3 bucket.

IAM evaluates whether the Lambda's execution role allows:

```text
s3:PutObject
```

If permitted, the upload proceeds.

Otherwise, the request is denied.

---

### Example 2 — ECS Reading Secrets

An ECS task needs database credentials.

IAM determines whether its task role can access:

```text
secretsmanager:GetSecretValue
```

If the permission exists, Secrets Manager returns the secret.

Otherwise, access is denied.

---

### Example 3 — Developer Using AWS CLI

A developer executes:

```bash
aws s3 ls
```

IAM evaluates whether that identity has permission to perform:

```text
s3:ListBucket
```

The command succeeds only if the required permission has been granted.

---

## What's Next?

The IAM Deep Dive explores how AWS evaluates permissions and secures cloud environments.

Topics include:

- Why IAM Exists
- Identity
- Authentication
- Authorization
- Principals
- Policies
- Permission Evaluation
- Roles
- Trust Relationships
- Temporary Credentials
- Users
- Groups
- Resource-based Policies
- Least Privilege
- Cross-Account Access
- Common Architecture
- Best Practices

By the end of the Deep Dive, you'll understand not only how IAM grants permissions, but also how nearly every AWS service depends on IAM to securely evaluate requests before accessing cloud resources.