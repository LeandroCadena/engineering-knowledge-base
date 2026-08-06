---
title: IAM Deep Dive
description: Master AWS Identity and Access Management by understanding how AWS evaluates permissions, authorizes requests, and secures cloud resources.
icon: aws-iam.png
order: 2
updatedAt: 2026-07-09
---

# IAM Deep Dive

# Principals

Every authorization request evaluated by AWS begins with a principal.

A principal represents the identity making a request to an AWS service. Before IAM can determine whether an operation should be allowed, it must first identify who or what is attempting to perform it.

Depending on the scenario, a principal may represent a human user, an AWS service, an IAM role, a temporary role session, or a federated identity.

![IAM Principals](/docs/aws/iam/iam-principals.png)

AWS identifies principals using Amazon Resource Names (ARNs).

For example, an IAM user is represented by:

```text
arn:aws:iam::123456789012:user/alice
```

while an assumed role session is represented by:

```text
arn:aws:sts::123456789012:assumed-role/application-role/backend
```

Applications can determine the current principal by calling AWS Security Token Service.

```bash
aws sts get-caller-identity
```

```json
{
  "UserId": "AROA123EXAMPLE:backend",
  "Account": "123456789012",
  "Arn": "arn:aws:sts::123456789012:assumed-role/application-role/backend"
}
```

The returned ARN identifies the principal currently executing the request and is one of the first tools used when investigating authorization issues.

---

# IAM Policies

IAM grants permissions through policies.

A policy is a JSON document that defines which actions are allowed or denied on specific AWS resources. Rather than embedding permissions directly into users or roles, IAM stores authorization rules inside reusable policy documents that can be attached to multiple identities.

A minimal IAM policy looks like this:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::application-files/*"
    }
  ]
}
```

This policy allows the `s3:GetObject` operation on every object stored inside the `application-files` S3 bucket.

Every policy consists of one or more statements.

The most common elements are:

- Version
- Statement
- Effect
- Action
- Resource
- Condition (optional)

Policies can be attached to:

- IAM Users
- IAM Groups
- IAM Roles

Once attached, the permissions defined by the policy become available to that principal.

Policies are also reusable. A single customer-managed policy can be attached to multiple users, groups, or roles without duplicating the permission definition.

## Creating a Policy

Policies can be created from the AWS Management Console or the AWS CLI.

The following command creates a customer-managed policy from a JSON document:

```bash
aws iam create-policy \
  --policy-name ReadApplicationFiles \
  --policy-document file://policy.json
```

The command returns the ARN of the newly created policy.

```json
{
  "Policy": {
    "PolicyName": "ReadApplicationFiles",
    "Arn": "arn:aws:iam::123456789012:policy/ReadApplicationFiles"
  }
}
```

## Attaching a Policy

After a policy has been created, it can be attached to an IAM principal.

For example, attaching the policy to an IAM role:

```bash
aws iam attach-role-policy \
  --role-name application-role \
  --policy-arn arn:aws:iam::123456789012:policy/ReadApplicationFiles
```

The role now inherits every permission defined by that policy.

The same policy could also be attached to additional roles, users, or groups, allowing permissions to be managed from a single reusable document instead of maintaining multiple copies.

---

# Actions and Resources

Every permission defined in an IAM policy answers two fundamental questions:

- What operation is being requested?
- Which resource can that operation be performed on?

These concepts are represented by the `Action` and `Resource` elements.

```json
{
  "Effect": "Allow",
  "Action": ["s3:GetObject", "s3:PutObject"],
  "Resource": "arn:aws:s3:::application-files/*"
}
```

The `Action` element specifies one or more AWS operations that the statement applies to.

Actions are always service-specific.

For example:

```text
s3:GetObject
s3:PutObject
lambda:InvokeFunction
dynamodb:GetItem
sqs:SendMessage
```

The `Resource` element identifies the AWS resources affected by those operations.

Some services require specific resources, while others allow all resources using the `*` wildcard.

```json
{
  "Action": "cloudwatch:ListMetrics",
  "Resource": "*"
}
```

Whenever possible, permissions should target specific resources rather than every resource in an AWS account.

The next chapter explains how AWS uniquely identifies every resource using Amazon Resource Names (ARNs).

---

# Amazon Resource Names (ARNs)

AWS uniquely identifies every resource using an Amazon Resource Name (ARN).

Rather than referencing resources by a simple name, IAM policies use ARNs to specify exactly which resource a permission applies to.

For example, the following policy grants access to objects stored inside a specific S3 bucket.

```json
{
  "Effect": "Allow",
  "Action": "s3:GetObject",
  "Resource": "arn:aws:s3:::application-files/*"
}
```

An ARN follows a standardized format:

```text
arn:partition:service:region:account-id:resource
```

Depending on the AWS service, some components may be omitted or use different separators.

For example:

```text
Amazon S3
arn:aws:s3:::application-files/images/logo.png

Lambda
arn:aws:lambda:us-east-1:123456789012:function:process-orders

DynamoDB
arn:aws:dynamodb:us-east-1:123456789012:table/Orders

SQS
arn:aws:sqs:us-east-1:123456789012:order-queue

IAM Role
arn:aws:iam::123456789012:role/application-role
```

Wildcards can be used to match multiple resources.

For example, granting access to every object inside an S3 bucket:

```text
arn:aws:s3:::application-files/*
```

or every Lambda function whose name starts with `process-`:

```text
arn:aws:lambda:us-east-1:123456789012:function:process-*
```

Whenever possible, policies should reference specific resources instead of using unrestricted wildcards, reducing the permissions granted to only the resources required by the application.

![ARN Structure](/docs/aws/iam/arn-structure.png)

---

# Conditions

Actions and resources define what a principal can do.

Conditions make those permissions context-aware by requiring additional criteria to be satisfied before a policy statement applies.

Instead of granting access unconditionally, IAM evaluates the specified conditions together with the request.

For example, the following policy only allows access when the request originates from a specific IP address.

```json
{
  "Effect": "Allow",
  "Action": "s3:GetObject",
  "Resource": "arn:aws:s3:::application-files/*",
  "Condition": {
    "IpAddress": {
      "aws:SourceIp": "203.0.113.0/24"
    }
  }
}
```

Conditions are evaluated using condition operators.

Each operator compares one or more condition keys against values present in the request context.

For example, requiring HTTPS:

```json
"Condition": {
  "Bool": {
    "aws:SecureTransport": "true"
  }
}
```

Restricting access to a specific AWS Region:

```json
"Condition": {
  "StringEquals": {
    "aws:RequestedRegion": "us-east-1"
  }
}
```

Requiring Multi-Factor Authentication (MFA):

```json
"Condition": {
  "Bool": {
    "aws:MultiFactorAuthPresent": "true"
  }
}
```

A single statement may contain multiple conditions.

Every condition must evaluate successfully before the statement is considered a match.

The following chapters introduce policy variables, request context, and permission evaluation, which determine how these conditions are interpreted during authorization.

![IAM Condition Operators](/docs/aws/iam/iam-condition-operators-cheatsheet.png)

---

# Permission Evaluation

Whenever a principal sends a request to an AWS service, IAM evaluates whether that operation should be allowed.

The decision is based on the request context and every policy that applies to the requesting principal and target resource.

Unlike a sequential list of rules, IAM combines multiple policy types before producing a final authorization decision.

The evaluation process follows three fundamental principles:

- Every request starts with an **implicit deny**.
- An **explicit allow** grants permission only if no other policy blocks the request.
- An **explicit deny** always overrides every allow.

For example, consider the following policy attached to an IAM role.

```json
{
  "Effect": "Allow",
  "Action": "s3:GetObject",
  "Resource": "arn:aws:s3:::application-files/*"
}
```

If the request matches the specified action and resource, IAM allows the operation unless another applicable policy explicitly denies it.

AWS provides the IAM Policy Simulator to test authorization decisions without executing real requests.

```bash
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::123456789012:role/application-role \
  --action-names s3:GetObject \
  --resource-arns arn:aws:s3:::application-files/report.pdf
```

The simulator returns whether the request is allowed or denied and identifies the policies that contributed to the decision.

As additional IAM features are introduced throughout this guide, they will become part of this evaluation process.

![IAM Permission Evaluation](/docs/aws/iam/iam-permission-evaluation.png)

---

# IAM Roles

An IAM Role is an AWS identity that can receive permissions without being permanently associated with a specific person or application.

Unlike IAM users, roles do not have long-term credentials such as passwords or access keys.

Instead, they are assumed temporarily by trusted principals, allowing AWS to issue short-lived credentials that expire automatically.

A role consists of two independent parts:

- **Permission policies**, which define what the role is allowed to do.
- **Trust policy**, which defines who is allowed to assume the role.

For example, the following command creates a new IAM role.

```bash
aws iam create-role \
  --role-name application-role \
  --assume-role-policy-document file://trust-policy.json
```

Permissions can then be attached to the role.

```bash
aws iam attach-role-policy \
  --role-name application-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess
```

At this point, the role has permissions, but it cannot yet be used until a trusted principal assumes it.

---

# Role Assumption

Creating an IAM role does not automatically grant access to AWS resources.

Before a role can be used, a trusted principal must assume it.

When a role is assumed, AWS Security Token Service (STS) validates the role's trust policy. If the principal is authorized, STS creates a temporary role session and returns temporary security credentials.

The following command assumes an IAM role:

```bash
aws sts assume-role \
  --role-arn arn:aws:iam::123456789012:role/application-role \
  --role-session-name backend-session
```

If the request succeeds, STS returns a new set of temporary credentials.

```json
{
  "Credentials": {
    "AccessKeyId": "...",
    "SecretAccessKey": "...",
    "SessionToken": "...",
    "Expiration": "2026-08-06T18:00:00Z"
  },
  "AssumedRoleUser": {
    "Arn": "arn:aws:sts::123456789012:assumed-role/application-role/backend-session"
  }
}
```

These credentials represent a new temporary principal with the permissions granted to the role.

The original principal is not replaced. Instead, a new role session is created and used to sign subsequent AWS requests.

![IAM Role Assumption](/docs/aws/iam/iam-role-assumption.png)

---

# AWS Security Token Service (STS)

AWS Security Token Service (STS) is responsible for issuing temporary security credentials.

Whenever a principal successfully assumes an IAM role, STS generates a new set of short-lived credentials that inherit the permissions granted to that role.

Unlike long-term IAM user credentials, STS credentials expire automatically after a configurable period of time.

A typical STS response contains:

```json
{
  "Credentials": {
    "AccessKeyId": "...",
    "SecretAccessKey": "...",
    "SessionToken": "...",
    "Expiration": "2026-08-06T18:00:00Z"
  }
}
```

Applications use these credentials exactly like permanent AWS credentials.

For example:

```bash
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_SESSION_TOKEN=...
```

Every request signed with these credentials is performed on behalf of the assumed role until the session expires.

In addition to `AssumeRole`, STS provides several operations for obtaining temporary credentials in different scenarios.

The AWS SDK automatically discovers and refreshes temporary credentials when supported credential providers are used, allowing applications running on AWS services to authenticate without storing permanent access keys.

![AWS STS Operations](/docs/aws/iam/aws-sts-operations.png)

---

# Service Roles

AWS services use IAM roles to obtain temporary credentials automatically.

Instead of storing permanent access keys inside an application, AWS can assume a role on behalf of the running service and securely provide temporary credentials.

From the application's perspective, no authentication code is required.

For example, the following Lambda function reads an object from Amazon S3.

```ts
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

const s3 = new S3Client({});

await s3.send(
  new GetObjectCommand({
    Bucket: 'application-files',
    Key: 'config.json',
  }),
);
```

Depending on where the application runs, AWS provides credentials through different mechanisms.

- **Lambda** uses an Execution Role.
- **Amazon ECS** uses a Task Role.
- **Amazon EC2** uses an Instance Profile.

Each mechanism ultimately provides temporary credentials issued by AWS Security Token Service (STS).

Because the credentials are temporary, applications no longer need to store long-term access keys, reducing the risk of credential leakage and simplifying credential rotation.

![AWS Service Roles](/docs/aws/iam/aws-service-roles.png)

---

# IAM Users

An IAM User represents a person or application that requires long-term access to an AWS account.

Unlike IAM roles, IAM users own permanent credentials until they are explicitly removed or rotated.

An IAM user can have one or more of the following authentication methods:

- A console password for accessing the AWS Management Console.
- Access keys for programmatic access through the AWS CLI or SDKs.
- Multi-Factor Authentication (MFA) for additional security.

IAM users do not receive permissions automatically.

Instead, permissions are granted by attaching IAM policies directly to the user or indirectly through IAM groups.

For example, a new IAM user can be created using the AWS CLI.

```bash
aws iam create-user \
  --user-name alice
```

By default, a newly created user has no permissions and cannot perform AWS operations until policies are assigned.

AWS recommends using IAM roles with temporary credentials for applications and workloads whenever possible, reserving IAM users primarily for human access and administrative tasks.

![IAM Users](/docs/aws/iam/iam-users.png)

---

# Resource-Based Policies

Until now, every policy in this guide has been attached to an IAM identity such as a user or role.

Some AWS services also allow policies to be attached directly to the resource itself.

These are known as **resource-based policies**.

Instead of defining what an identity can access, a resource-based policy defines who is allowed to access that resource.

For example, the following Amazon S3 bucket policy grants read access to a role from another AWS account.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::222222222222:role/application-role"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::application-files/*"
    }
  ]
}
```

Unlike identity-based policies, resource-based policies introduce the **Principal** element.

The principal identifies which AWS account, IAM user, IAM role, or AWS service is allowed to access the resource.

Several AWS services support resource-based policies, including:

- Amazon S3
- Amazon SQS
- Amazon SNS
- AWS Lambda
- AWS KMS
- Amazon EventBridge
- Amazon API Gateway

When both identity-based and resource-based policies exist, IAM evaluates them together during authorization.

This model is commonly used for cross-account access and for allowing AWS services to interact securely with specific resources.

![Identity-Based vs Resource-Based Policies](/docs/aws/iam/identity-vs-resource-policies.png)

---

# Permissions Boundaries

A permissions boundary defines the maximum permissions that an IAM user or role can receive.

Unlike identity-based policies, a permissions boundary never grants access by itself.

Instead, it limits the permissions that identity-based policies are allowed to grant.

For example, consider the following permissions boundary.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:*",
      "Resource": "*"
    }
  ]
}
```

Now suppose the role also has the following identity policy.

```json
{
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "lambda:InvokeFunction"],
      "Resource": "*"
    }
  ]
}
```

Although the identity policy allows both Amazon S3 and AWS Lambda operations, the permissions boundary only allows Amazon S3 actions.

As a result, the effective permissions become:

```text
✓ s3:GetObject

✗ lambda:InvokeFunction
```

A permissions boundary acts as a maximum permission set.

The final permissions available to the principal are the intersection between the identity policy and the permissions boundary.

Permissions boundaries are commonly used to delegate IAM administration while preventing users from granting permissions beyond an approved limit.

![IAM Permissions Boundaries](/docs/aws/iam/iam-permissions-boundaries.png)

---

# Session Policies

A session policy is an optional policy passed when assuming an IAM role.

Unlike identity policies, session policies do not grant additional permissions.

Instead, they further restrict the permissions available during a specific role session.

For example, consider a role that allows access to every object in an Amazon S3 bucket.

```json
{
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::application-files/*"
    }
  ]
}
```

When assuming the role, an additional session policy can be supplied.

```bash
aws sts assume-role \
  --role-arn arn:aws:iam::123456789012:role/application-role \
  --role-session-name reporting-session \
  --policy file://session-policy.json
```

The session policy might further restrict access to a single folder.

```json
{
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::application-files/reports/*"
    }
  ]
}
```

Although the role itself can access every object in the bucket, the temporary session can only access objects inside the `reports` folder.

Like permissions boundaries, session policies never expand permissions.

The effective permissions are the intersection between the role's policies and the session policy.

Session policies are commonly used to temporarily reduce permissions for specific workflows without modifying the role itself.

![IAM Session Policies](/docs/aws/iam/iam-session-policies.png)

---

# Organization Policy Controls

When multiple AWS accounts are managed through AWS Organizations, administrators can define organization-wide permission limits using Service Control Policies (SCPs).

Unlike IAM policies, SCPs do not grant permissions.

Instead, they define the maximum permissions available within an AWS account or organizational unit (OU).

For example, the following SCP prevents every principal in an account from deleting Amazon S3 buckets.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Deny",
      "Action": "s3:DeleteBucket",
      "Resource": "*"
    }
  ]
}
```

Even if an IAM role explicitly allows `s3:DeleteBucket`, the operation is still denied because SCPs are evaluated before IAM permissions become effective.

SCPs are attached to AWS Organizations, organizational units (OUs), or individual AWS accounts.

This allows administrators to enforce organization-wide security guardrails while still letting each account manage its own IAM users and roles.

![AWS Organizations Service Control Policies](/docs/aws/iam/aws-organizations-scp.png)

---

# Cross-Account Access

AWS allows principals in one account to access resources located in another account without sharing long-term credentials.

This is achieved by combining IAM roles, trust policies, and AWS Security Token Service (STS).

Suppose an application running in **Account A** needs to access resources stored in **Account B**.

First, Account B creates an IAM role with a trust policy that allows principals from Account A to assume the role.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::111111111111:root"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

The application in Account A then assumes the role.

```bash
aws sts assume-role \
  --role-arn arn:aws:iam::222222222222:role/cross-account-role \
  --role-session-name application-session
```

If the request succeeds, STS returns temporary credentials that represent the role in Account B.

Every subsequent AWS request is authorized using those temporary credentials.

This approach allows AWS accounts to collaborate securely without exchanging permanent access keys.

![IAM Cross-Account Access](/docs/aws/iam/iam-cross-account-access.png)

---

# Permission Analysis

When an AWS request is denied, the first step is determining which policy prevented the operation.

Because multiple policy types can participate in the authorization process, diagnosing permission issues requires inspecting both the request context and the applicable policies.

AWS provides several tools to help analyze authorization decisions.

The current identity can be verified using AWS Security Token Service.

```bash
aws sts get-caller-identity
```

This confirms which principal is signing the request.

To evaluate permissions without executing an API call, AWS provides the IAM Policy Simulator.

```bash
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::123456789012:role/application-role \
  --action-names s3:GetObject \
  --resource-arns arn:aws:s3:::application-files/report.pdf
```

For broader security analysis, IAM Access Analyzer identifies resources that are accessible from outside the account and helps detect unintended access.

CloudTrail records every AWS API request, making it possible to determine which principal performed an action and why it succeeded or failed.

Use the following checklist to systematically identify the policy preventing the request.

![IAM Permission Analysis](/docs/aws/iam/iam-permission-analysis.png)

---

# Putting Everything Together

The following diagram summarizes the complete AWS IAM authorization process presented throughout this guide.

It shows how a principal obtains credentials, submits a request to an AWS service, and how IAM evaluates every applicable policy before making the final authorization decision.

![AWS IAM Authorization Pipeline](/docs/aws/iam/aws-iam-authorization-pipeline.png)
