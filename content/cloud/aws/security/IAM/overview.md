---
title: IAM Overview
description: Understand what AWS Identity and Access Management (IAM) is, how it authorizes access to AWS resources, and why it serves as the foundation of security across nearly every AWS service.
icon: aws-iam.png
order: 1
updatedAt: 2026-08-06
---

# IAM

## Definition

AWS Identity and Access Management (IAM) is the authorization service responsible for controlling access to AWS resources.

Rather than allowing unrestricted access to cloud infrastructure, IAM evaluates every request against a centralized set of permissions to determine whether the requested action should be allowed.

By enforcing consistent authorization across AWS services, IAM enables organizations to securely control access while following the Principle of Least Privilege.

---

## How it Works

Every request sent to an AWS service is evaluated before the requested operation executes.

IAM identifies who is making the request, what action is being requested, which resource is being accessed, and whether the configured permissions authorize that operation.

![IAM Authorization Flow](/docs/aws/iam/iam-overview-authorization-flow.png)

---

## How it Fits into the Ecosystem

IAM acts as the centralized authorization layer for nearly every AWS service.

Applications, users, AWS services, and automated workloads authenticate using AWS identities, while IAM determines whether the requested operation can access the target resource.

![IAM Ecosystem](/docs/aws/iam/iam-overview-ecosystem.png)

---

## What It Looks Like

IAM is managed through the AWS Management Console, where administrators create and manage identities, roles, policies, and permissions.

Although IAM can also be managed through the AWS CLI, SDKs, or Infrastructure as Code tools, the console provides a centralized interface for configuring and auditing access across an AWS account.

![AWS IAM Console](/docs/aws/iam/iam-overview-console.png)

---

## Common Use Cases

### Serverless Applications

Lambda functions use IAM execution roles to securely access AWS services without embedding credentials in application code.

### Cloud Applications

Applications running on EC2, ECS, or EKS obtain temporary credentials through IAM roles to securely interact with AWS resources.

### CI/CD Pipelines

Deployment systems use IAM roles to build, deploy, and manage cloud infrastructure while limiting permissions to only the required operations.

### Cross-Account Access

Organizations use IAM roles to securely grant controlled access between AWS accounts without sharing long-term credentials.
