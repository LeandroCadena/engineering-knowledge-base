---
title: IAM Deep Dive
description: Master AWS Identity and Access Management by understanding how AWS evaluates permissions, authorizes requests, and secures cloud resources.
order: 2
updatedAt: 2026-07-09
---

# IAM Deep Dive

## Why IAM Exists

Cloud platforms expose hundreds of services capable of storing data, processing requests, managing infrastructure, and interacting with external systems.

Without an authorization system, every authenticated identity would effectively have unrestricted access to every resource.

IAM exists to solve this problem.

Its responsibility is to determine whether a request should be allowed to perform a specific action on a specific AWS resource.

Rather than embedding authorization logic into every AWS service, AWS centralizes authorization decisions within IAM.

This provides a consistent security model across the entire platform.

:::at-a-glance

### Why IAM Exists

- Centralized authorization.
- Fine-grained permissions.
- Consistent security model.
- Least Privilege.

:::

:::misconceptions

❌ IAM performs AWS operations.

✅ IAM only decides whether an operation is authorized.

AWS services perform the actual work.

:::

:::production-note

Almost every AWS request is evaluated by IAM before reaching the target service.

Understanding IAM is therefore fundamental to understanding AWS itself.

:::

---

## Identity

An identity represents the entity attempting to interact with AWS.

Every request evaluated by IAM is associated with an identity.

Examples include:

- Human users.
- Applications.
- AWS services.
- Containers.
- Lambda functions.

An identity does not automatically possess permissions.

Permissions are granted separately through IAM policies.

:::at-a-glance

### Identity

- Represents who is making the request.
- Required for authorization.
- Independent from permissions.

:::

:::misconceptions

❌ Creating an identity automatically grants access.

✅ Identities only define who is making the request.

Permissions must be explicitly granted.

:::

---

## Authentication

Authentication answers one question:

> **Who is making this request?**

Before AWS evaluates permissions, it must verify the identity associated with the request.

Authentication may occur using:

- IAM Users.
- Temporary credentials.
- Access keys.
- IAM Roles.
- AWS STS.

Authentication establishes identity.

It does not determine permissions.

:::at-a-glance

Authentication verifies identity.

:::

---

## Authorization

Authorization answers a different question:

> **Is this identity allowed to perform this action?**

After authentication succeeds, IAM evaluates all applicable policies.

The result is always one of two decisions:

```text
Allow

or

Deny
```

Authorization depends on:

- Identity.
- Requested action.
- Target resource.
- Applicable policies.
- Explicit denies.

:::at-a-glance

Authorization determines permissions.

:::

:::misconceptions

❌ Authentication automatically grants permissions.

✅ Authentication establishes identity.

Authorization determines whether the requested operation is permitted.

:::

---

## Permission Evaluation

Every request made to AWS follows the same authorization process.

Rather than granting permissions based on a single rule, IAM evaluates multiple sources before making a final decision.

```text
AWS Request

↓

Authenticate Identity

↓

Collect Applicable Policies

↓

Evaluate Permissions

↓

Allow

or

Deny
```

Every authorization decision considers:

- Who is making the request.
- Which action is requested.
- Which resource is being accessed.
- Which policies apply.
- Whether any explicit deny exists.

The evaluation always produces one of two possible outcomes:

- Allow
- Deny

:::at-a-glance

### Permission Evaluation

- Request-based.
- Policy-driven.
- Default deny.
- Explicit allow required.
- Explicit deny overrides everything.

:::

:::misconceptions

❌ AWS searches for one policy that grants access.

✅ AWS evaluates every applicable policy before making a final authorization decision.

:::

:::production-note

Understanding the permission evaluation process is more important than memorizing IAM policies.

Nearly every authorization issue in AWS can be explained by understanding how IAM evaluates requests.

:::

---

## Evaluation Logic

Permission evaluation follows a predictable sequence.

```text
Request

↓

Authenticated?

↓

No

↓

Reject

──────────────

Yes

↓

Collect Policies

↓

Explicit Deny?

↓

Yes

↓

Deny

──────────────

No

↓

Explicit Allow?

↓

Yes

↓

Allow

──────────────

No

↓

Implicit Deny
```

AWS starts from the principle that every request is denied unless permission has been explicitly granted.

This behavior is known as **Implicit Deny**.

Only an explicit **Allow** changes that decision.

However, if any applicable policy contains an **Explicit Deny**, the request is denied regardless of any Allows.

:::at-a-glance

### Evaluation Order

1. Authenticate.
2. Collect policies.
3. Check Explicit Deny.
4. Check Explicit Allow.
5. Otherwise, Implicit Deny.

:::

:::misconceptions

❌ Multiple Allow policies always grant access.

✅ A single Explicit Deny overrides every Allow.

:::

:::production-note

Many AWS permission issues are caused by unexpected Explicit Deny statements inherited from organization-wide security policies.

:::

---

## Implicit Deny vs Explicit Deny

Understanding the difference between these two concepts is fundamental.

### Implicit Deny

Every request begins in a denied state.

If no policy grants permission, AWS rejects the request.

```text
No Allow Found

↓

Implicit Deny
```

---

### Explicit Deny

An Explicit Deny intentionally blocks an operation.

Even if multiple policies allow the request, a single Explicit Deny takes precedence.

```text
Allow

↓

Explicit Deny

↓

Final Decision

↓

Deny
```

:::at-a-glance

### Deny Types

Implicit Deny

- Default behavior.
- No matching Allow.

Explicit Deny

- Intentionally configured.
- Overrides every Allow.

:::

:::misconceptions

❌ IAM grants access unless a policy blocks it.

✅ IAM denies access unless a policy explicitly grants permission.

:::

:::practical-note

Thinking of IAM as a "default deny" system helps explain nearly every authorization decision.

Permissions are never assumed—they must always be granted explicitly.

:::

---

## Principals

A Principal is any authenticated identity that can make a request to AWS.

Whenever IAM evaluates permissions, it does so on behalf of a Principal.

In other words, every AWS request has a Principal associated with it.

Common principals include:

- IAM Users.
- IAM Roles.
- AWS Services.
- AWS Accounts.
- Federated identities.

```text
Principal

↓

AWS Request

↓

IAM Evaluation

↓

Allow

or

Deny
```

A Principal does not define permissions by itself.

It simply identifies **who** is requesting access.

Permissions are determined separately through policies.

:::at-a-glance

### Principals

- Represent authenticated identities.
- Initiate AWS requests.
- Evaluated by IAM.
- Independent from permissions.

:::

:::misconceptions

❌ Principals define permissions.

✅ Principals identify the requester.

Permissions are defined by IAM policies.

:::

:::production-note

Many IAM errors become easier to diagnose by first identifying the Principal making the request before analyzing attached policies.

:::

---

## Policies

Policies define what a Principal is allowed or denied to do.

They are JSON documents containing one or more permission statements.

A policy typically specifies:

- Which actions are allowed.
- Which resources are affected.
- Under which conditions the permission applies.

Conceptually:

```text
Principal

↓

Policy

↓

Allowed Actions

↓

AWS Resource
```

Policies are declarative.

Rather than describing how AWS should perform an operation, they describe whether an operation is permitted.

:::at-a-glance

### Policies

- Define permissions.
- JSON documents.
- Attached to identities or resources.
- Evaluated by IAM.

:::

:::misconceptions

❌ Policies execute AWS operations.

✅ Policies only describe which operations are authorized.

:::

---

## Policy Structure

Although policies may vary considerably, most follow the same logical structure.

```json
{
  "Effect": "Allow",
  "Action": ["s3:GetObject"],
  "Resource": ["arn:aws:s3:::example-bucket/*"]
}
```

The most important fields are:

### Effect

Defines whether the statement allows or denies the request.

Possible values:

- Allow
- Deny

---

### Action

Specifies the AWS operations affected.

Examples:

- `s3:GetObject`
- `lambda:InvokeFunction`
- `sqs:SendMessage`

---

### Resource

Defines which AWS resources the statement applies to.

Resources are identified using Amazon Resource Names (ARNs).

:::at-a-glance

### Core Policy Elements

- Effect.
- Action.
- Resource.

:::

:::misconceptions

❌ Policies always grant access.

✅ Policies may either allow or explicitly deny operations.

:::

:::practical-note

When reading an unfamiliar policy, focus first on Effect, Action, and Resource.

Those three elements explain the vast majority of IAM permissions.

:::

---

## Amazon Resource Names (ARNs)

AWS identifies every resource using a globally unique identifier called an Amazon Resource Name (ARN).

A simplified ARN looks like:

```text
arn:aws:s3:::example-bucket
```

or

```text
arn:aws:lambda:us-east-1:123456789012:function:process-orders
```

Policies reference resources using ARNs to specify exactly which resources are affected.

This allows permissions to be extremely granular.

:::at-a-glance

### ARNs

- Globally unique resource identifiers.
- Used inside IAM policies.
- Enable fine-grained authorization.

:::

:::misconceptions

❌ Policies apply to every AWS resource by default.

✅ Policies generally specify which resources are affected using ARNs.

:::

:::production-note

Learning to read ARNs quickly makes IAM policies significantly easier to understand and debug.

:::

---

## Roles

An IAM Role is an identity that defines a set of permissions but is not permanently associated with a specific user or application.

Unlike IAM Users, Roles are designed to be assumed temporarily by trusted principals.

When a principal assumes a Role, AWS provides temporary credentials that inherit the permissions defined by that Role.

```text
Principal

↓

Assume Role

↓

Temporary Credentials

↓

AWS Request

↓

IAM Evaluation

↓

Allow

or

Deny
```

Roles eliminate the need to distribute long-lived credentials while enabling secure access between AWS services and applications.

Typical examples include:

- Lambda accessing S3.
- ECS reading Secrets Manager.
- EC2 writing to CloudWatch.
- Step Functions invoking Lambda.
- Cross-account access.

:::at-a-glance

### Roles

- Temporary identity.
- Assumed by trusted principals.
- Provide temporary credentials.
- Preferred over long-lived credentials.

:::

:::misconceptions

❌ Roles contain permanent credentials.

✅ Roles define permissions. AWS generates temporary credentials only while the Role is being assumed.

:::

:::production-note

Modern AWS architectures should prefer IAM Roles over IAM Users whenever possible.

Service-to-service communication should almost always rely on Roles instead of static access keys.

:::

---

## Why Roles Exist

Before IAM Roles, applications commonly authenticated using long-lived Access Keys.

```text
Application

↓

Access Key

↓

AWS
```

This approach introduced several problems:

- Credentials had to be stored securely.
- Keys could be leaked.
- Rotation was difficult.
- Compromised keys remained valid until manually revoked.

IAM Roles solve these problems by issuing temporary credentials on demand.

```text
Application

↓

IAM Role

↓

Temporary Credentials

↓

AWS
```

Because credentials expire automatically, the attack surface is significantly reduced.

:::at-a-glance

### Why Roles Exist

- Eliminate long-lived credentials.
- Automatic credential rotation.
- Improved security.
- Simplified operations.

:::

:::misconceptions

❌ Roles are simply another way to organize permissions.

✅ Roles fundamentally change how applications authenticate to AWS by replacing permanent credentials with temporary ones.

:::

:::production-note

If an AWS service can use an IAM Role, that approach is generally preferred over embedding Access Keys in configuration files or environment variables.

:::

---

## Assuming a Role

A Role does not automatically grant permissions.

It must first be assumed by a trusted principal.

When a principal assumes a Role, AWS Security Token Service (STS) issues temporary security credentials.

```text
Principal

↓

AssumeRole

↓

AWS STS

↓

Temporary Credentials

↓

AWS Services
```

These credentials include:

- Access Key ID.
- Secret Access Key.
- Session Token.
- Expiration time.

Once the credentials expire, they can no longer be used.

:::at-a-glance

### Assume Role

- Temporary session.
- Credentials issued by STS.
- Automatic expiration.
- Limited lifetime.

:::

:::misconceptions

❌ Assuming a Role permanently changes an identity.

✅ Assuming a Role creates a temporary security session with a separate set of credentials.

:::

:::

---

## Temporary Credentials

When a principal successfully assumes an IAM Role, AWS Security Token Service (STS) issues a temporary set of security credentials.

Unlike long-lived Access Keys, these credentials automatically expire after a limited period.

A temporary credential set typically contains:

- Access Key ID
- Secret Access Key
- Session Token
- Expiration Time

```text
Principal

↓

Assume Role

↓

AWS STS

↓

Temporary Credentials

↓

AWS Request
```

From that point forward, every AWS request made using those credentials is evaluated using the permissions granted to the assumed Role.

Because the credentials expire automatically, the risk associated with credential leakage is significantly reduced.

:::at-a-glance

### Temporary Credentials

- Issued by AWS STS.
- Automatically expire.
- Used exactly like normal AWS credentials.
- Inherit the Role's permissions.

:::

:::misconceptions

❌ Temporary credentials provide fewer permissions than the Role.

✅ Temporary credentials inherit exactly the permissions granted to the assumed Role.

:::

:::production-note

Temporary credentials are one of the foundations of AWS security.

Modern AWS applications should rely on temporary credentials instead of distributing long-lived Access Keys.

:::

---

## AWS Security Token Service (STS)

AWS Security Token Service (STS) is the service responsible for issuing temporary security credentials.

Rather than permanently storing credentials for every application, STS generates credentials only when they are needed.

```text
Principal

↓

Request AssumeRole

↓

STS

↓

Temporary Credentials

↓

AWS Services
```

STS is commonly used by:

- Lambda
- ECS
- EC2
- Step Functions
- AWS CLI
- Cross-account access
- Federated identities

Applications rarely communicate with STS directly.

Most AWS services automatically request temporary credentials on behalf of the application.

:::at-a-glance

### AWS STS

- Issues temporary credentials.
- Supports AssumeRole.
- Central to IAM Role authentication.
- Used automatically by many AWS services.

:::

:::misconceptions

❌ STS authenticates users.

✅ STS issues temporary credentials after IAM determines that a principal is allowed to assume a Role.

:::

:::production-note

Although developers often configure only IAM Roles, STS performs the credential issuance behind the scenes for almost every modern AWS workload.

:::

---

## Credential Lifecycle

Temporary credentials follow a predictable lifecycle.

```text
Principal

↓

Assume Role

↓

STS Issues Credentials

↓

Application Uses Credentials

↓

Credentials Expire

↓

Role Assumed Again

↓

New Credentials
```

Every new session receives a fresh set of credentials.

Expired credentials can no longer be used to access AWS resources.

This continuous credential rotation happens automatically and requires no manual intervention from the application.

:::at-a-glance

### Credential Lifecycle

- Request credentials.
- Receive temporary session.
- Use credentials.
- Expire automatically.
- Renew when necessary.

:::

:::misconceptions

❌ Applications are responsible for rotating temporary credentials.

✅ AWS SDKs and AWS services automatically refresh temporary credentials when required.

:::

:::production-note

Automatic credential rotation significantly reduces operational complexity compared to managing long-lived Access Keys.

:::

---

## Trust Relationships

Permission Policies answer one question:

> **What is this Role allowed to do?**

Trust Relationships answer a different question:

> **Who is allowed to assume this Role?**

Both are required.

Having permissions attached to a Role is not sufficient.

A principal must also be explicitly trusted before AWS allows it to assume the Role.

```text
Principal

↓

Trust Relationship

↓

Assume Role?

↓

Yes

↓

Temporary Credentials

↓

Permission Policies

↓

AWS Request

↓

Allow / Deny
```

Trust Relationships act as the entrance to a Role.

Permission Policies determine what happens after entering.

:::at-a-glance

### Trust Relationships

- Control role assumption.
- Define trusted principals.
- Separate from permissions.
- Required before permissions are evaluated.

:::

:::misconceptions

❌ Attaching permissions to a Role allows anyone to use it.

✅ A Role must explicitly trust the principal attempting to assume it.

Permissions alone are not enough.

:::

:::production-note

When a Role cannot be assumed, the problem is often the Trust Relationship rather than the attached permission policies.

:::

---

## Trust Policies

Trust Relationships are implemented using Trust Policies.

Unlike Permission Policies, Trust Policies do not describe AWS actions such as:

- `s3:GetObject`
- `lambda:InvokeFunction`

Instead, they describe which principals are trusted to assume the Role.

Conceptually:

```text
Principal

↓

Trust Policy

↓

May Assume Role?

↓

Yes

↓

STS Issues Credentials
```

A Trust Policy commonly trusts:

- AWS Services.
- IAM Roles.
- IAM Users.
- AWS Accounts.
- Federated identities.

:::at-a-glance

### Trust Policies

- Implement Trust Relationships.
- Define trusted principals.
- Evaluated before credentials are issued.

:::

:::misconceptions

❌ Trust Policies grant access to AWS resources.

✅ Trust Policies only determine whether a principal may assume a Role.

Permissions are evaluated afterwards using Permission Policies.

:::

---

## Permission Policies vs Trust Policies

Although both are IAM policies, they solve different problems.

| Permission Policy                 | Trust Policy                       |
| --------------------------------- | ---------------------------------- |
| Defines permissions               | Defines trusted principals         |
| Evaluated after assuming the Role | Evaluated before assuming the Role |
| Controls AWS actions              | Controls Role assumption           |
| References AWS resources          | References principals              |

A successful Role assumption requires both.

```text
Trust Policy

↓

Role Assumed

↓

Permission Policy

↓

AWS Resource
```

:::at-a-glance

### Two Different Responsibilities

Trust Policy

- Who?

Permission Policy

- What?

:::

:::practical-note

Whenever you troubleshoot IAM Roles, ask two independent questions:

1. Is the principal allowed to assume the Role?
2. Once assumed, does the Role have permission to perform the requested action?

Separating these questions dramatically simplifies IAM debugging.

:::

---

## Service Roles

Many AWS services automatically assume IAM Roles while executing workloads.

Examples include:

```text
Lambda

↓

Execution Role

↓

STS

↓

Temporary Credentials

↓

S3
```

```text
ECS Task

↓

Task Role

↓

STS

↓

Temporary Credentials

↓

Secrets Manager
```

```text
EC2 Instance

↓

Instance Profile

↓

STS

↓

Temporary Credentials

↓

CloudWatch
```

Applications never receive permanent AWS credentials.

AWS transparently assumes the configured Role and manages temporary credentials throughout the workload's lifetime.

:::at-a-glance

### Service Roles

- Used by AWS services.
- Automatically assumed.
- No embedded credentials.
- Recommended for production.

:::

:::production-note

Execution Roles, Task Roles, and Instance Profiles all follow the same underlying IAM model.

Although they are configured differently depending on the AWS service, they all rely on Trust Relationships, STS, and temporary credentials.

:::

---

## IAM Users

An IAM User represents a permanent identity typically assigned to a human user.

Unlike IAM Roles, IAM Users have long-lived credentials that remain valid until they are rotated, disabled, or deleted.

An IAM User may authenticate using:

- Username and password (AWS Management Console).
- Access Keys (AWS CLI or SDKs).
- Multi-Factor Authentication (MFA).

```text
Developer

↓

IAM User

↓

Authenticate

↓

AWS Request

↓

IAM Evaluation
```

Permissions are not automatically granted to an IAM User.

Instead, they are assigned through IAM Policies, either directly or through IAM Groups.

:::at-a-glance

### IAM Users

- Permanent identities.
- Primarily represent people.
- Can authenticate to AWS.
- Permissions assigned through policies.

:::

:::misconceptions

❌ IAM Users should be used by every application.

✅ Modern AWS applications should generally use IAM Roles instead of IAM Users.

IAM Users are primarily intended for human access.

:::

:::production-note

AWS recommends minimizing the use of long-lived Access Keys.

Applications should prefer IAM Roles with temporary credentials whenever possible.

:::

---

## Access Keys

IAM Users may create Access Keys for programmatic access.

An Access Key consists of:

- Access Key ID.
- Secret Access Key.

Applications can use these credentials to authenticate AWS API requests.

```text
Application

↓

Access Key

↓

AWS

↓

IAM Evaluation
```

Although functional, Access Keys introduce operational challenges:

- Secure storage.
- Credential rotation.
- Leakage risk.
- Manual lifecycle management.

These limitations are one of the primary reasons IAM Roles are preferred for workloads running inside AWS.

:::at-a-glance

### Access Keys

- Long-lived credentials.
- Programmatic authentication.
- Require manual management.

:::

:::misconceptions

❌ Access Keys are the recommended authentication mechanism for AWS applications.

✅ Access Keys are mainly intended for external clients or legacy integrations.

Applications running inside AWS should generally rely on IAM Roles.

:::

:::production-note

Never commit Access Keys to source control or embed them in application code.

Use IAM Roles or secure secret management whenever possible.

:::

---

## Multi-Factor Authentication (MFA)

Multi-Factor Authentication adds an additional verification step during authentication.

Instead of relying only on a password, the user must also provide a second authentication factor.

Typical factors include:

- Authenticator applications.
- Hardware security keys.
- FIDO2 devices.

```text
Username

+

Password

+

MFA

↓

Authenticated User
```

MFA strengthens authentication but does not affect authorization.

Permissions continue to be determined by IAM policies after authentication succeeds.

:::at-a-glance

### MFA

- Strengthens authentication.
- Protects human identities.
- Independent from authorization.

:::

:::misconceptions

❌ MFA grants additional permissions.

✅ MFA only increases confidence in the user's identity.

Authorization is still determined by IAM policies.

:::

:::production-note

Administrator accounts should always require MFA.

Compromised passwords become significantly less useful when MFA is enforced.

:::

---

## IAM Groups

An IAM Group is a collection of IAM Users.

Rather than assigning the same permissions to each user individually, administrators can attach policies to a Group.

Every user within the Group automatically inherits those permissions.

```text
IAM Policy

↓

IAM Group

↓

Developer A

Developer B

Developer C
```

Groups simplify permission management by allowing administrators to manage permissions at the group level instead of the individual user level.

Only IAM Users can belong to Groups.

IAM Roles cannot be members of Groups.

:::at-a-glance

### IAM Groups

- Organize IAM Users.
- Simplify permission management.
- Policies inherited by members.
- Administrative convenience.

:::

:::misconceptions

❌ Groups introduce a new permission model.

✅ Groups are simply a management layer for assigning policies to multiple IAM Users.

Permission evaluation works exactly the same.

:::

:::production-note

Groups are useful for managing permissions for human users, such as developers, administrators, or support teams.

They are not used for AWS services or application workloads.

:::

---

## Direct Policies vs Groups

Permissions may be attached directly to an IAM User or inherited through an IAM Group.

Both approaches produce the same authorization result.

```text
Option 1

IAM User

↓

Policy

──────────────

Option 2

IAM Group

↓

Policy

↓

IAM User
```

Groups reduce duplication and make permission management significantly easier as organizations grow.

:::at-a-glance

### Permission Assignment

- Direct attachment.
- Group inheritance.
- Same permission evaluation.

:::

:::misconceptions

❌ Group permissions override user permissions.

✅ IAM evaluates all applicable policies together according to the standard permission evaluation process.

:::

:::

---

## Resource-based Policies

So far, every permission we've discussed has been attached to an identity.

This approach is known as **Identity-based Authorization**.

```text
Principal

↓

Identity Policy

↓

AWS Resource
```

Some AWS services support another authorization model.

Instead of attaching permissions to the identity, permissions are attached directly to the resource itself.

```text
Principal

↓

AWS Resource

↓

Resource Policy

↓

Allow / Deny
```

In this model, the resource participates in the authorization decision by defining which principals may access it.

:::at-a-glance

### Resource-based Policies

- Attached to resources.
- Define trusted principals.
- Evaluated during authorization.
- Complement identity-based policies.

:::

:::misconceptions

❌ Every AWS service supports Resource-based Policies.

✅ Only specific AWS services provide Resource-based Policies.

Examples include S3, SQS, SNS, EventBridge, KMS, and API Gateway.

:::

:::production-note

Resource-based Policies are commonly used when resources must be accessed across AWS accounts or by external AWS services.

:::

---

## Identity-based vs Resource-based Policies

Although both are IAM policies, they answer different questions.

| Identity-based Policy                     | Resource-based Policy                     |
| ----------------------------------------- | ----------------------------------------- |
| Attached to a Principal                   | Attached to a Resource                    |
| Defines what the Principal may do         | Defines who may access the Resource       |
| Evaluated from the identity's perspective | Evaluated from the resource's perspective |

In many scenarios, AWS evaluates both types of policies before making an authorization decision.

```text
Principal

↓

Identity Policy

↓

Resource Policy

↓

Permission Evaluation

↓

Allow / Deny
```

:::at-a-glance

### Two Authorization Models

Identity-based

- What can this identity do?

Resource-based

- Who can access this resource?

:::

:::misconceptions

❌ Resource-based Policies replace Identity Policies.

✅ Both models complement each other and may be evaluated together depending on the AWS service.

:::

---

## Common Use Cases

Resource-based Policies are especially valuable when access must be granted without modifying another account's IAM identities.

Typical examples include:

- Allowing another AWS account to access an S3 bucket.
- Allowing EventBridge to invoke a Lambda function.
- Allowing SNS to publish messages to an SQS queue.
- Allowing API Gateway to invoke a Lambda function.

In these situations, the resource itself defines which principals are trusted.

:::at-a-glance

### Common Scenarios

- Cross-account access.
- Service-to-service communication.
- Shared resources.
- Event-driven architectures.

:::

:::production-note

Many AWS integrations rely on Resource-based Policies because the target resource can explicitly trust another AWS service or account without changing that external identity.

:::

---

## Principle of Least Privilege

The Principle of Least Privilege states that every identity should receive only the permissions required to perform its intended tasks.

No identity should have broader permissions simply because they might be useful in the future.

```text
Application

↓

Required Actions

↓

Minimal Permissions

↓

AWS Resources
```

Rather than asking:

> "Which permissions could this application use?"

Least Privilege asks:

> "Which permissions does this application actually require?"

Reducing permissions limits the impact of configuration mistakes, software bugs, and compromised credentials.

:::at-a-glance

### Principle of Least Privilege

- Grant only necessary permissions.
- Minimize attack surface.
- Reduce accidental access.
- Improve security.

:::

:::misconceptions

❌ It is easier to grant broad permissions and restrict them later.

✅ Permissions should start as narrowly scoped as possible and expand only when justified by actual requirements.

:::

:::production-note

Least Privilege is one of the most important security principles across cloud platforms and should guide every IAM design decision.

:::

---

## Applying Least Privilege

Applying Least Privilege means limiting permissions in several dimensions simultaneously.

### Limit Actions

Grant only the AWS actions that are actually required.

Instead of:

```text
s3:*
```

Prefer:

```text
s3:GetObject
s3:PutObject
```

---

### Limit Resources

Restrict permissions to specific resources whenever possible.

Instead of:

```text
Resource: *
```

Prefer:

```text
arn:aws:s3:::production-images/*
```

---

### Limit Principals

Only trusted identities should receive permissions.

Avoid sharing Roles or credentials across unrelated applications.

---

### Limit Duration

Prefer temporary credentials over long-lived Access Keys.

IAM Roles automatically support this principle through STS.

:::at-a-glance

### Apply Least Privilege

- Restrict actions.
- Restrict resources.
- Restrict principals.
- Prefer temporary credentials.

:::

:::practical-note

Least Privilege is achieved by combining multiple restrictions rather than relying on a single narrow policy.

:::

---

## Why Least Privilege Matters

Permissions represent potential impact.

The broader the permissions, the greater the consequences if an identity is compromised.

For example:

```text
Compromised Application

↓

IAM Role

↓

s3:*

↓

Every Bucket
```

Compared to:

```text
Compromised Application

↓

IAM Role

↓

s3:GetObject

↓

One Bucket
```

Both applications have been compromised.

However, the second architecture limits what the attacker can do.

Least Privilege reduces the blast radius of security incidents.

:::at-a-glance

### Benefits

- Smaller attack surface.
- Reduced blast radius.
- Easier auditing.
- Better compliance.

:::

:::misconceptions

❌ Least Privilege prevents attacks.

✅ It does not prevent compromises, but significantly limits their potential impact.

:::

:::production-note

Modern cloud security assumes that compromises are possible.

Least Privilege focuses on minimizing the damage when they occur rather than assuming they never will.

:::

---

## Cross-Account Access

Organizations often operate multiple AWS accounts.

Rather than sharing long-lived credentials between accounts, AWS allows identities in one account to temporarily assume Roles in another account.

This mechanism is known as **Cross-Account Access**.

```text
AWS Account A

↓

Principal

↓

Assume Role

↓

AWS Account B

↓

IAM Role

↓

Temporary Credentials

↓

AWS Resources
```

Cross-Account Access enables secure collaboration between AWS accounts without exposing permanent credentials.

:::at-a-glance

### Cross-Account Access

- Secure access across AWS accounts.
- Uses IAM Roles.
- Relies on temporary credentials.
- Avoids credential sharing.

:::

:::misconceptions

❌ Cross-account access requires sharing Access Keys.

✅ AWS uses IAM Roles and STS to provide temporary credentials instead of permanent secrets.

:::

:::production-note

Large organizations commonly separate environments such as Development, Staging, and Production into different AWS accounts.

Cross-Account Access allows controlled interaction between them while maintaining strong security boundaries.

:::

---

## Cross-Account Authorization Flow

A Cross-Account request combines several IAM concepts working together.

```text
Principal (Account A)

↓

Attempt AssumeRole

↓

Trust Policy (Account B)

↓

STS

↓

Temporary Credentials

↓

Permission Policies

↓

AWS Resource

↓

Allow / Deny
```

Each stage has a distinct responsibility:

- The **Trust Policy** determines whether the external principal may assume the Role.
- **STS** issues temporary credentials.
- **Permission Policies** determine what the assumed Role may do.
- The target AWS service performs its normal permission evaluation before executing the request.

Cross-Account Access is therefore an extension of the same authorization model already used within a single AWS account.

:::at-a-glance

### Authorization Flow

- Trust the external principal.
- Assume the Role.
- Receive temporary credentials.
- Evaluate permissions.
- Access resources.

:::

:::misconceptions

❌ Cross-account access bypasses IAM.

✅ Cross-account requests still follow the same IAM permission evaluation process.

The only difference is that the principal originates from another AWS account.

:::

---

## Common Use Cases

Cross-Account Access is widely used to isolate workloads while still allowing controlled collaboration.

Typical examples include:

### CI/CD Pipelines

A deployment pipeline running in one AWS account assumes a deployment Role in another account.

---

### Multi-Environment Deployments

Applications in a Development account temporarily access shared resources located in a Production account without sharing credentials.

---

### Centralized Logging

Applications from multiple AWS accounts send logs to a centralized logging account.

---

### Shared Infrastructure

Multiple AWS accounts access shared resources such as S3 buckets, KMS keys, or Secrets Manager through explicitly trusted Roles.

:::at-a-glance

### Common Scenarios

- Multi-account architectures.
- CI/CD.
- Centralized logging.
- Shared infrastructure.

:::

:::production-note

As organizations grow, multi-account strategies become increasingly common.

Cross-Account Access provides the secure foundation that allows those accounts to collaborate while remaining operationally isolated.

:::

---

## Common Architecture

The following architecture illustrates how IAM components collaborate during a typical production request.

```text
                   Developer

                        │

              AWS CLI / Console

                        │

                 IAM User (MFA)

                        │

                 Assume Admin Role

                        │

                    AWS STS

                        │

            Temporary Credentials

                        │

────────────────────────────────────────────────────────────

                  Deploy Lambda

                        │

               Lambda Execution Role

                        │

                    AWS STS

                        │

            Temporary Credentials

                        │

             ┌──────────┼──────────┐
             ▼          ▼          ▼

            S3         SQS     Secrets Manager

             │          │          │

       IAM Evaluation for every request

             │          │          │

             ▼          ▼          ▼

        Allow / Deny Allow / Deny Allow / Deny
```

Although this architecture appears to involve many components, every AWS request follows the same authorization model.

For each request:

1. A principal makes the request.
2. IAM authenticates the identity.
3. IAM evaluates all applicable policies.
4. IAM determines whether the request is allowed.
5. The AWS service executes the operation only if authorization succeeds.

Regardless of whether the request targets S3, Lambda, DynamoDB, or Secrets Manager, the authorization process remains consistent.

:::at-a-glance

### IAM in Production

- Principals initiate requests.
- Roles provide permissions.
- STS issues temporary credentials.
- IAM evaluates every request.
- AWS services execute only after authorization succeeds.

:::

:::production-note

One of IAM's greatest strengths is consistency.

Once you understand how IAM authorizes one AWS service, you already understand the authorization model used by nearly every other AWS service.

:::

---

## Responsibility Flow

Each IAM component has a distinct responsibility.

```text
Identity

↓

Authentication

↓

Authorization

↓

Role

↓

STS

↓

Temporary Credentials

↓

AWS Service

↓

Resource
```

Each component answers a different question.

| Component      | Responsibility                         |
| -------------- | -------------------------------------- |
| Identity       | Who is making the request?             |
| Authentication | Is the identity genuine?               |
| Authorization  | Is the action permitted?               |
| Policies       | What permissions exist?                |
| Role           | Package permissions for temporary use. |
| Trust Policy   | Who may assume the Role?               |
| STS            | Issue temporary credentials.           |
| AWS Service    | Execute the requested operation.       |

Separating responsibilities keeps IAM predictable and scalable.

Each component focuses on one concern instead of combining authentication, authorization, credential management, and resource execution into a single system.

:::at-a-glance

### Responsibility Model

- Authentication verifies identity.
- Authorization evaluates permissions.
- Roles package permissions.
- STS issues credentials.
- AWS services perform work.

:::

:::misconceptions

❌ IAM executes AWS operations.

✅ IAM only evaluates whether operations are permitted.

The target AWS service performs the requested action after authorization succeeds.

:::

---

## Best Practices

Successful IAM implementations are built around clear security principles rather than individual configuration choices.

The following recommendations summarize the concepts covered throughout this document.

### Prefer IAM Roles over IAM Users

Applications running inside AWS should authenticate using IAM Roles whenever possible.

Roles provide temporary credentials, eliminate embedded secrets, and simplify credential rotation.

---

### Prefer Temporary Credentials

Long-lived Access Keys increase operational complexity and security risk.

Whenever possible, applications should rely on temporary credentials issued by AWS STS.

---

### Apply the Principle of Least Privilege

Grant only the permissions required to perform a specific task.

Restrict:

- Actions.
- Resources.
- Principals.
- Credential lifetime.

---

### Scope Permissions to Specific Resources

Avoid broad permissions such as:

```text
Resource: *
```

Instead, grant access only to the resources that are actually required.

---

### Separate Authentication from Authorization

Authentication determines who is making the request.

Authorization determines what that identity is allowed to do.

Keeping these concerns separate simplifies system design and improves security.

---

### Protect Human Identities

Human users should:

- Use Multi-Factor Authentication (MFA).
- Avoid long-lived Access Keys.
- Assume Roles when elevated permissions are required.

---

### Prefer Cross-Account Roles

Avoid sharing credentials between AWS accounts.

Instead, allow trusted principals to assume Roles through properly configured Trust Relationships.

---

### Regularly Review Permissions

As applications evolve, permissions often become broader than necessary.

Regular permission reviews help maintain Least Privilege and reduce unnecessary access.

:::at-a-glance

### Production Checklist

- Prefer IAM Roles.
- Use temporary credentials.
- Apply Least Privilege.
- Restrict actions and resources.
- Protect human users with MFA.
- Use Cross-Account Roles.
- Review permissions regularly.

:::

:::production-note

Most IAM security incidents are not caused by flaws in IAM itself, but by overly broad permissions, long-lived credentials, or unnecessary administrative access.

Well-designed IAM architectures focus on minimizing both the probability and the impact of security incidents.

:::

---

# Putting Everything Together

The following diagram summarizes how IAM authorizes a request from the moment an identity interacts with AWS until a service executes the requested operation.

```text
                         Principal
                              │
                              ▼
                      Authentication
                              │
                              ▼
                       IAM Evaluation
                              │
          ┌───────────────────┼───────────────────┐
          ▼                                       ▼
 Identity-based Policies              Resource-based Policies
          │                                       │
          └───────────────────┬───────────────────┘
                              ▼
                     Permission Evaluation
                              │
                    Explicit Deny?
                              │
                    Yes ─────────────► Deny
                              │
                             No
                              │
                     Explicit Allow?
                              │
                    No ──────────────► Implicit Deny
                              │
                             Yes
                              │
                              ▼
                     Assume Role (if required)
                              │
                              ▼
                    Trust Relationship
                              │
                              ▼
                         AWS STS
                              │
                              ▼
                  Temporary Credentials
                              │
                              ▼
                       AWS Service
                              │
                              ▼
                         AWS Resource
                              │
                              ▼
                     Requested Operation
```

Although IAM contains many concepts, every authorization decision follows the same fundamental process.

First, AWS verifies the identity making the request.

Next, IAM evaluates all applicable policies, including identity-based and resource-based policies, while honoring explicit deny rules.

If a Role must be assumed, IAM validates the Trust Relationship before AWS STS issues temporary credentials.

Finally, the target AWS service executes the requested operation only if authorization succeeds.

Rather than thinking of IAM as a collection of Users, Roles, and Policies, it is more useful to view it as a centralized authorization engine that consistently evaluates every request made across AWS.

---

## Final Perspective

IAM is far more than a permission management system.

It provides the authorization model that underpins nearly every AWS service.

Understanding IAM means understanding how AWS identifies principals, evaluates permissions, issues temporary credentials, delegates access, and enforces security boundaries across cloud resources.

Once this authorization model is understood, services such as Lambda, ECS, S3, SQS, API Gateway, DynamoDB, and Secrets Manager become significantly easier to learn because they all rely on the same IAM foundation.
