---
title: AWS IAM
description: Principals and temporary credentials, policy statements and conditions, role trust and PassRole, policy evaluation boundaries, cross-account access, federation, and authorization diagnosis.
icon: aws-iam.png
updatedAt: 2026-11-08
---

# AWS IAM

AWS Identity and Access Management controls access to AWS service operations. A request is evaluated using its principal, requested action, target resource and available context. IAM authorization is separate from application authorization: a Lambda role permitted to read an S3 object does not establish whether the API's end user is entitled to that object.

An Orders worker illustrates three independent questions: who may deploy the worker with a particular role, whether Lambda may assume that role, and whether the resulting session may write the Orders table. Solving one does not automatically solve the other two.

This reading covers IAM identities, roles, policy evaluation and common workload delegation. Service-specific authorization still matters: S3, KMS, Lambda and other services have their own supported actions, resource types, conditions and policy behavior. Example account IDs and resource names are placeholders, not existing infrastructure.

## Identities, Principals & Credentials

An IAM user is an identity in an AWS account that can have a console password or long-term programmatic access keys. User groups collect permissions for IAM users; a group is not an authenticating principal and cannot be assumed like a role. New users do not gain application-resource access just by existing.

A role is an assumable identity with permissions and a trust policy. Assuming it produces a temporary **role session**, rather than a permanent access key owned by the role. The role ARN and session ARN identify different entities:

```text
arn:aws:iam::222222222222:role/orders-worker
arn:aws:sts::222222222222:assumed-role/orders-worker/session-104
```

Temporary credentials contain an access key ID, secret access key, session token and expiration. The SDK must use the token as well as the key pair. Credentials identify the caller and sign requests; the effective authorization can still change when applicable policies change. Expiration is not the only control on access.

The AWS account root user has exceptional account-level authority and is not an ordinary IAM user. Protect root access and use it only for tasks requiring it. Human access normally belongs in federation or IAM Identity Center with temporary sessions and appropriate MFA, rather than shared IAM-user access keys. Workloads should use their platform's role credential mechanism.

The SDK credential provider chain selects a credential source from its environment and configuration. A developer's exported access keys can override the expected profile or role provider. Creating an SDK client does not prove which principal will sign its first request; resolve the caller when diagnosing access.

## Policies, Actions & Resource ARNs

An identity-based policy grants or denies actions to the identity to which it is attached. A resource-based policy, where the service supports it, is attached to the resource and can identify permitted principals. Customer-managed policies are reusable objects; inline policies are embedded in one identity. A managed policy update can affect every attachment, so its scope is part of the change review.

A policy statement combines `Effect`, `Action`, `Resource` and optional `Condition`. Resource-based policies also name a `Principal`. `Sid` labels statements for maintenance. `Version: "2012-10-17"` selects policy language semantics, not the policy's creation date.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadOnlyOrderExports",
      "Effect": "Allow",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::example-order-exports/reports/*"
    },
    {
      "Sid": "ListOnlyReports",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::example-order-exports",
      "Condition": {
        "StringLike": { "s3:prefix": ["reports/*"] }
      }
    }
  ]
}
```

Object reads require object ARNs; listing uses the bucket ARN and can restrict the requested prefix. A caller listing without the required `reports/` prefix will not match this allow. Granting `s3:GetObject` does not itself grant listing, writing, deleting or decryption with every KMS key. These are separate authorization decisions.

An ARN has a partition, service, region, account and resource component, but services format these differently. S3 bucket/object ARNs omit region and account fields. Other partitions use prefixes such as `arn:aws-us-gov`; hard-coding `arn:aws` in reusable infrastructure can make it invalid outside that partition.

Some actions have no resource-level permission support and require `Resource: "*"`. That does not justify putting every other action into the same unrestricted statement. Consult the service authorization reference for resource types, dependent actions and condition keys. `NotAction` means a complement over actions in context, not a short synonym for a carefully enumerated allowlist.

## Conditions & Request Context

A condition determines whether a statement applies; it does not create a separate grant. Operators compare context values with policy values: strings, ARNs, booleans, IP ranges, dates and numbers have distinct operators. Multiple condition operators and keys generally combine with AND; multiple positive candidate values for a key commonly combine with OR. Negated operators and multivalued keys need their own rules rather than that shorthand.

A request may lack a context key. Ordinary positive comparisons generally do not match a missing key; `Null`, negated operators and `...IfExists` change that behavior. A `Deny` containing a negated `...IfExists` comparison can still deny when the key is absent. Test both present and missing values before treating a condition as a security boundary.

For tag-based access, compare principal/session attributes with supported resource tags. Also control who can set those tags or pass session tags: an untrusted caller who assigns its own privileged attribute can bypass the intended separation. An MFA-related condition is not interchangeable across IAM-user sessions, federated identities and service calls because their context keys differ.

`aws:RequestedRegion` identifies the requested endpoint's region; it is not a universal guarantee that the operation has no effects elsewhere. Similarly, `aws:SourceIp` must be interpreted for the actual request path, including service-to-service calls and VPC endpoints. Conditions work only when the service supplies the relevant context.

## Role Trust & STS Sessions

A role's trust policy controls who may assume it and under which conditions. Its permission policies control what an authorized session can do afterward. Adding DynamoDB permissions to the role does not make Lambda a trusted caller; trusting Lambda does not grant table access.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "lambda.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

Lambda uses this trust relationship to assume the function's execution role and supply temporary credentials. The application normally relies on the runtime credential provider instead of calling `AssumeRole` for its own execution role. ECS task roles and EC2 instance profiles provide analogous workload integration through different platform mechanisms; deployment and application roles must not be confused.

![Role assumption and later service access are separate authorization decisions](/docs/aws/iam/v2/role-session.svg)

An explicit `AssumeRole` request is authorized separately from later requests signed by the returned credentials. The later requests do not simply add the caller's original permissions to the assumed role. Session policies, when supplied, can restrict the role's permissions; they cannot use that identity-based path to expand the role's permissions. Role chaining also imposes session-duration constraints.

For cross-account role assumption, the caller account must authorize `sts:AssumeRole` on the target role and the target's trust policy must accept that caller under its conditions. A trust principal such as `arn:aws:iam::111111111111:root` delegates to that **account**, not exclusively to its root user. Restrict the trusted principal or applicable principal conditions when account-wide delegation is too broad.

:::check{question="Lambda trusts an execution role, but the role has no DynamoDB permission. Can the handler write the table because assumption succeeded?"}
No. Trust authorizes creation of the session, not the table operation. The table request needs an applicable permission grant and must survive the other applicable authorization controls. Conversely, a table allow on a role that Lambda cannot assume does not repair its trust policy.
:::

## Permission Evaluation & Guardrails

For ordinary IAM principals, absence of an applicable grant produces an **implicit deny**. An applicable explicit deny overrides an allow. Policy statements are not processed as an ordered firewall list: placing an allow after a deny does not cancel the deny.

For the common identity-policy permission path, a permissions boundary limits what the identity's policies can grant, a session policy limits a session, and applicable Organizations controls further constrain access. A boundary or SCP does not grant access on its own. An allowed action must survive every applicable limiting layer on that path.

![An identity-policy grant constrained by boundary, session and organization controls](/docs/aws/iam/v2/permission-path.svg)

The diagram describes that **identity-policy path**, not a universal intersection formula for all AWS authorization. Resource policies create important differences within one account:

| Resource policy grants directly to | Relevant same-account distinction                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| IAM user ARN                       | The grant is not limited by an implicit deny in the user's identity policy or permissions boundary.                       |
| IAM role ARN                       | Implicit restrictions in the role's permissions boundary and session policy still constrain the grant.                    |
| Assumed-role session ARN           | Permissions go directly to that session and are not limited by implicit denies in identity, boundary or session policies. |

Applicable explicit denies still matter. Organization controls and service-specific requirements must also be considered. Do not intentionally target session principals as a shortcut around intended guardrails. A resource policy using a wildcard principal plus a principal-ARN condition has its own evaluation details and should not be assumed identical to directly naming a role ARN.

Service Control Policies constrain principals in affected member accounts; they do not grant permissions. They do not constrain the management account in the same way or apply to service-linked roles. Resource Control Policies constrain supported resources in affected accounts. Their coverage is service-specific. These controls are organization guardrails, not replacements for role or resource policies.

KMS authorization includes key-policy rules, and service endpoint policies can further restrict a request path. A simple IAM allow is insufficient evidence that encrypted S3 access, for example, must succeed. Determine the actual resource and every service participating in the operation.

:::check{question="A role's identity policy allows PutItem, but its permissions boundary does not allow it. Will attaching a second identity policy with PutItem fix this path?"}
No. Additional identity allows cannot expand the maximum allowed by the boundary on that path. Change the intended boundary through its approved control process or change the design. Separately review resource-policy paths rather than assume every principal type has identical implicit-deny behavior.
:::

## Cross-Account Resources & Confused Deputies

A cross-account resource call generally needs authorization on both sides: the caller's identity-based permissions and the destination resource's policy, subject to the service's authorization model. Assuming a destination-account role is another pattern: afterward, that session accesses resources as a role in the destination account. Trust authorizes the role transition; it does not automatically grant all destination resources.

A confused deputy occurs when a trusted service or third party performs privileged work for an unintended customer. A resource policy trusting a service principal should restrict the source account and source resource with `aws:SourceAccount` and `aws:SourceArn` where the integration supports and supplies those keys. Do not copy these conditions blindly into every execution-role trust policy: unavailable keys can prevent legitimate service access.

For a third-party cross-account role integration, an external ID can bind assumption to the intended customer under the deputy's control. It is not a replacement for restricting the trusted principal and is not a secret password. OIDC federation instead validates a configured provider and token claims; constrain audience and subject so unrelated repositories, branches or identities cannot assume a CI role.

GitHub Actions can exchange an OIDC token for a narrowly trusted deployment-role session instead of storing long-term AWS keys. The trust conditions define which workflow identity may request the session; that role's permission policy defines its deployment powers. Neither establishes trust in arbitrary code running inside that permitted workflow.

## PassRole & Privilege Escalation

`iam:PassRole` authorizes configuring a service with a role it will use. It does not return role credentials and is not the same operation as `sts:AssumeRole`. A deployment principal may need permission to create/update a Lambda function **and** pass its chosen execution role. The role must also trust the service, and PassRole applies to roles in the same account as the service receiving them.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": "arn:aws:iam::222222222222:role/orders-worker",
      "Condition": {
        "StringEquals": { "iam:PassedToService": "lambda.amazonaws.com" }
      }
    }
  ]
}
```

This statement alone does not grant deployment or invocation. Combined with the ability to deploy or replace code under that role, it can nevertheless let a caller exercise the role's permissions through Lambda. Review the combination of code changes, role creation/attachment, trust changes, policy-version management and PassRole rather than each permission in isolation. A narrow PassRole resource does not make an excessively privileged execution role safe.

:::check{question="A developer cannot read a protected bucket directly, but can replace code in a function whose role can read it. Does the missing direct s3:GetObject permission protect the bucket from that developer?"}
No. The developer can cause the function's role to perform the read. Deployment authority over code is authority over the workload's usable permissions. Separate deployment controls, restrict execution-role scope and protect the paths that can change roles or their policies.
:::

## Authorization Diagnosis & Verification

Start with `aws sts get-caller-identity` under the same credential source as the failing client. Record the exact action, resource, account, region and relevant request context; a friendly resource name is not enough to distinguish a bucket operation from an object operation or a role from its session.

| Evidence              | What it can establish                               | Limitation                                                                                               |
| --------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Caller identity       | Which account/session signs the request             | Does not list effective permissions.                                                                     |
| Access-denied details | A missing grant or denying control when disclosed   | Error detail varies by service and account relationship.                                                 |
| IAM policy simulation | Decisions for modeled policies and supplied context | Does not reproduce every service, cross-account or endpoint-policy interaction.                          |
| IAM Access Analyzer   | Policy validation and supported access findings     | A validation pass is not proof that every intended request succeeds.                                     |
| CloudTrail            | Recorded API activity and caller/error context      | Data events require the appropriate configuration; not every possible request is automatically recorded. |

Distinguish credential failures, expired sessions, DNS/network errors and application authorization from an IAM policy denial. After policy changes, allow for propagation and retry with a bounded verification plan; repeatedly attaching broad access can hide the missing specific action or context.

Validate both allowed and forbidden cases: intended object versus another prefix, correct service versus another service, intended CI subject versus another branch, and missing context values. Keep policies under version control and use live AWS validation for the target account when needed. A local JSON parser or a hand-written matcher cannot certify AWS's authorization decision.

[Executable example and policy verification instructions](https://github.com/LeandroCadena/engineering-knowledge-base/tree/codex/iam-lambda-readings/examples/iam-lambda-readings)
