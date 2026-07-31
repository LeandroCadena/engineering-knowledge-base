# Writing Guidelines

## Purpose

The purpose of this knowledge base is not to simplify technologies.

The goal is to help readers truly understand them.

Every document should build an accurate mental model by explaining:

- Why a technology exists.
- How it works.
- Where it fits within real software systems.
- How it behaves in production.

Understanding should always result from reasoning, never memorization.

## What Is a Mental Model?

A mental model is an internal explanation of how a technology works.

It allows readers to predict behavior, reason about architectural decisions, understand trade-offs, and explain new situations without memorizing isolated facts.

Every document in this knowledge base exists to help readers progressively build this model.

If readers can explain _why_ a technology behaves the way it does, they have built the correct mental model.

---

# 1. Learning Philosophy

These principles define how every document in the knowledge base should teach.

They apply regardless of the technology being documented.

---

## Prefer Understanding Over Completeness

The objective of a document is not to mention every feature, option, or capability of a technology.

Its objective is to build a mental model that allows readers to reason about the technology with confidence.

A shorter document that produces deep understanding is more valuable than a comprehensive document that overwhelms readers with isolated information.

Whenever a decision must be made between completeness and understanding, always choose understanding.

Readers should finish the document feeling that the technology became simpler, not that the document became longer.

---

## Never Assume Previous Knowledge

Never introduce an important concept without providing enough context for the reader to continue learning.

Readers should never stop because an unfamiliar term suddenly appears without explanation.

Introduce new concepts only after providing the minimum knowledge required to understand them.

---

## Build Knowledge Progressively

Knowledge should be constructed one concept at a time.

Every section should answer the questions naturally created by the previous one.

The reader should feel that each new concept is the logical consequence of everything already learned.

Learning should resemble a conversation rather than a collection of independent chapters.

---

## Explain Reasons Before Rules

Never tell readers what to do before explaining why.

Good documentation teaches reasoning instead of memorization.

Readers should naturally reach conclusions through understanding rather than accepting recommendations without context.

Whenever possible, explain the problem first.

Then explain the design decision that solves it.

---

## Teach Systems, Not Technologies

Technologies never exist in isolation.

Every document should explain:

- why the technology exists;
- what problem it solves;
- where it fits inside a software architecture;
- how it interacts with surrounding technologies.

The objective is to build engineers who understand complete systems rather than isolated tools.

---

## Explain Concepts Before Implementation

Implementation is meaningful only after readers understand the concepts behind it.

Introduce architecture before syntax.

Introduce behavior before APIs.

Introduce ideas before code.

Readers who understand the model can easily learn the implementation.

The opposite is rarely true.

---

## Reduce Complexity Without Hiding It

Complex ideas should never be oversimplified.

Instead, divide them into smaller concepts that can be understood independently.

Accuracy should never be sacrificed for simplicity.

The objective is not to make technologies appear easy.

The objective is to make complex technologies understandable.

---

# 2. Learning Progression

Understanding depends not only on what is explained, but also on the order in which concepts appear.

---

## Every Section Answers One Question

Every section should have one clear learning objective.

Avoid answering questions that belong to future sections.

A well-structured document naturally creates curiosity about the next concept without explicitly announcing it.

Readers should feel that every new section answers the question they were already asking.

---

## Every Paragraph Answers One Question

Avoid isolated facts.

Each paragraph should answer a question readers naturally have at that point.

If a paragraph introduces information that does not answer an existing question, reconsider its placement.

---

## Every Sentence Should Teach Something

Every sentence must contribute new understanding.

Remove any sentence whose only purpose is:

- introducing the next section;
- summarizing what was already explained;
- filling space;
- guiding readers through the document.

If removing a sentence does not reduce understanding, it probably does not belong.

---

## No Meta Narration

Never describe the learning process.

Avoid expressions such as:

- Now that we understand...
- The next section explains...
- We will revisit this later...
- Before continuing...
- Keep this in mind...
- As we have seen...

The document itself should naturally guide readers through its progression.

The writing should discuss the technology, never the document itself.

---

## Build Curiosity Naturally

Do not announce future concepts.

Instead, organize the document so that every section naturally raises the question answered by the next one.

Readers should never feel guided.

They should feel that the document is unfolding naturally.

---

## Comparisons Require Prior Knowledge

Never compare concepts before introducing them individually.

Comparisons reinforce understanding.

They should never become the primary explanation.

Introduce each concept independently.

Only compare them after readers understand both.

---

# 3. Scope and Concept Classification

Every document has a limited responsibility.

Its goal is to teach one technology as clearly as possible.

A document should never expand its scope simply because related concepts are important.

Readers should always be able to distinguish between concepts that belong to the technology itself and concepts that exist outside of it.

---

## Keep the Scope Focused

A document teaches one technology.

Not every technology related to it.

Whenever a new concept appears, ask:

> Is this concept part of the technology I'm documenting, or does it only help explain it?

The answer determines both how deeply it should be explained and where it belongs in the document.

---

## Explaining External Concepts

Most technologies depend on concepts that belong elsewhere.

For example:

- AWS Lambda depends on IAM.
- Kubernetes depends on Linux containers.
- Node.js depends on JavaScript.
- React applications communicate using HTTP.

These concepts should not be fully explained unless they are the subject of the current document.

Instead:

- define only what readers need to understand the current technology;
- explain why the concept matters;
- avoid implementation details;
- avoid expanding the document's scope.

If the concept deserves a complete explanation, create a dedicated document for it.

The purpose of a document is to explain its own technology, not everything surrounding it.

---

# Concept Classification

Every concept introduced should first be classified.

This determines both its level of explanation and its position within the document.

---

## Core Concepts

Core concepts belong to the technology being documented.

Without understanding them, readers cannot correctly understand the technology itself.

Core concepts should always receive a complete explanation before being used.

Examples in an AWS Lambda Deep Dive:

- Execution Environments
- Cold Starts
- Warm Starts
- Concurrency
- Invocation Types
- Memory Allocation

Examples in a Node.js Deep Dive:

- Event Loop
- V8
- Non-blocking I/O
- Worker Threads

---

## Supporting Concepts

Supporting concepts improve understanding but are not part of the technology's internal architecture.

Explain only enough to understand their relationship with the current technology.

Examples:

- IAM inside AWS Lambda
- HTTP inside Node.js
- DNS inside HTTP
- Kubernetes inside Docker

Supporting concepts provide context.

They do not become the focus of the document.

---

## Independent Concepts

Some concepts deserve their own dedicated documentation.

When these concepts appear inside another document:

- acknowledge them;
- define them briefly;
- explain why they matter;
- avoid teaching them in depth.

Examples:

- Idempotency
- OAuth
- TLS
- CAP Theorem
- Event Sourcing

Once dedicated documentation exists, reference it instead of expanding the explanation.

---

# Heading Hierarchy

Heading levels communicate scope.

They are not merely visual.

---

## Primary Sections (`##`)

Use `##` for concepts that belong to the technology itself.

These chapters define the primary learning path.

Readers should expect every `##` section to teach part of the technology's architecture, execution model, or behavior.

---

### Supporting Sections (`###`)

Use `###` for concepts that support understanding but do not belong to the technology itself.

Supporting sections exist to provide context without expanding the document's scope.

For example, in an AWS Lambda Deep Dive:

```text
## Retry Behavior

## Dead Letter Queues

### Idempotency

## Security Model
```

In this example:

- Retry Behavior belongs to Lambda.
- Dead Letter Queues belong to Lambda.
- Idempotency is an independent architectural concept.
- Security Model belongs to Lambda because it describes how Lambda integrates with IAM rather than explaining IAM itself.

Readers should be able to understand the document hierarchy simply by looking at the heading levels.

---

# 4. Visual Communication

Diagrams are not decorative elements.

They are another teaching medium.

Every visual decision should be made with the same objective as every writing decision:

Maximize understanding while minimizing cognitive load.

Readers should learn because of the diagrams, not simply look at them.

---

## Teach Using the Best Medium

Before writing a section, decide which medium communicates the concept most effectively.

The objective is not to maximize text or illustrations.

The objective is to choose the medium that teaches the concept most clearly.

Every section should begin with this question:

> What is the best way to teach this concept?

Only after answering that question should writing or diagramming begin.

---

## Choosing Between Text and Images

Use the following decision process for every section.

### Step 1 — Can a diagram teach the entire concept?

If a single illustration communicates the complete idea more clearly than prose, use only the diagram.

Avoid adding paragraphs that merely describe what readers can already see.

The diagram becomes the explanation.

Example:

- Lambda Invocation Types
- Request/Response lifecycle
- Component interaction diagrams

---

### Step 2 — Can a diagram teach part of the concept better?

If part of the explanation benefits from visualization while other parts require reasoning or context, use both.

However:

The text and the diagram must teach different things.

The text should explain ideas.

The diagram should explain relationships, interactions or execution.

Neither should repeat the other.

---

### Step 3 — Does the diagram simply repeat the text?

If removing the diagram does not reduce understanding:

Do not create the diagram.

Likewise, if removing the surrounding paragraphs does not reduce understanding:

Remove the paragraphs.

Every teaching element must justify its existence.

---

## Images Can Replace Text

A diagram is allowed to become the primary explanation.

If an illustration communicates the concept more effectively than prose, let it do so.

Do not add paragraphs simply because the section "needs text."

Some concepts are better explained visually.

Others are better explained through reasoning.

Choose the medium that teaches best.

---

## Complexity Determines the Medium

Not every concept deserves a diagram.

Reserve diagrams for concepts that are difficult to visualize mentally.

Typical examples include:

- execution flows;
- multiple actors;
- component relationships;
- distributed systems;
- state transitions;
- request lifecycles;
- event propagation;
- asynchronous workflows.

Simple concepts usually remain as text.

Examples include:

- definitions;
- responsibilities;
- architectural decisions;
- isolated behaviors;
- design principles.

---

## Diagrams Should Reduce Cognitive Load

A diagram exists to make understanding easier.

It should reduce the amount of mental work required to build the correct model.

If readers can understand the concept equally well from concise text, a diagram adds no value.

Do not create illustrations for visual balance.

Create them only when they improve learning.

---

## Never Describe a Diagram

If a diagram already explains a concept, surrounding text should not narrate it.

Instead, use the text to explain:

- why the concept matters;
- what readers should pay attention to;
- how it relates to the rest of the technology;
- architectural implications that are not immediately visible.

Readers should never feel they are reading an image caption expanded into several paragraphs.

---

## Every Visual Element Must Teach Something New

Every illustration must introduce new understanding.

If two diagrams explain the same concept, remove one.

If text and a diagram communicate the same information, remove whichever teaches less effectively.

Each element should have one clear teaching responsibility.

---

## Maintain a Consistent Visual Language

Every diagram in the knowledge base should immediately feel familiar.

Maintain consistency across:

- colors;
- typography;
- borders;
- spacing;
- icons;
- arrows;
- terminology;
- layout;
- visual hierarchy.

Consistency allows readers to recognize recurring concepts without relearning the visual language in every document.

The objective is not visual identity.

The objective is reducing cognitive load across the entire knowledge base.

---

# 5. Document Types

The knowledge base is composed of two complementary document types.

Each serves a different purpose and should be written with a different depth.

Readers should never feel that one document repeats the other.

Instead, each document should answer a different set of questions.

---

# Overview

## Purpose

The purpose of an Overview is to build a correct mental model of a technology.

By the end of an Overview, readers should understand:

- why the technology exists;
- what problem it solves;
- how it works at a high level;
- where it fits inside modern software systems;
- what it looks like in real projects;
- when it is commonly used.

The Overview should provide understanding, not mastery.

Its objective is to answer the questions every software engineer should be able to answer.

Typical reading time:

10–15 minutes.

---

## Structure

Every Overview should follow the same structure.

1. Definition
2. How it Works
3. How it Fits into the Ecosystem
4. What It Looks Like
5. Common Use Cases

Each section answers one specific learning objective.

Do not introduce architectural details that belong in the Deep Dive.

---

## Definition

The Definition establishes the foundation for everything that follows.

It should explain:

- what the technology is;
- why it exists;
- the responsibility it has within a software system;
- what it is not.

Readers should finish this section understanding the purpose of the technology before learning how it works.

---

## How It Works

Explain the technology's high-level behavior.

Describe how the technology behaves from a technical perspective, using the core concepts that define its operation.

You may reference concepts that are explained later in the Deep Dive, but do not explain them here.

The goal is to provide a concise technical overview that reinforces the reader's mental model without replacing the detailed explanations found in the Deep Dive.

Avoid configuration details, implementation specifics, APIs, or advanced workflows.

Readers should finish this section understanding how the technology operates, while recognizing the concepts that will be explored in depth later.

---

## How it Fits into the Ecosystem

Explain where the technology sits within a real architecture.

Show:

- what communicates with it;
- what depends on it;
- what problems it solves.

Technologies should never appear isolated.

---

## What It Looks Like

Whenever the technology has a graphical interface, management console, desktop application, IDE, dashboard or visual environment, include this section.

Use real screenshots whenever possible.

Readers should recognize the technology when they encounter it professionally.

Help readers recognize the technology in professional environments.

---

## Common Use Cases

Demonstrate how the technology is applied in production.

Prefer multiple focused workflows over one oversized architecture diagram.

Each use case should explain:

- the problem;
- why the technology is appropriate;
- the workflow at a high level.

---

# Deep Dive

## Purpose

A Deep Dive explains how a technology actually works.

Its objective is not to teach implementation.

Its objective is to develop the understanding required to reason about the technology like a senior engineer.

Readers should finish the document understanding the technology's internal behavior, architectural decisions and production characteristics.

Typical reading time:

30–60 minutes.

---

## Structure

Unlike an Overview, a Deep Dive is organized around concepts rather than features.

Each chapter should answer one architectural question.

Concepts should be introduced independently before being connected together.

Typical topics include:

- internal architecture;
- execution model;
- lifecycle;
- concurrency;
- memory;
- performance;
- reliability;
- security;
- operational behavior;
- design decisions.

Not every technology requires every topic.

Choose the concepts that define how the technology works internally.

---

## Chapter Patterns

Most Deep Dive chapters fall into one of four categories.

### Definition Chapters

Introduce a single concept.

Usually text only.

Examples:

- Event Loop
- Execution Environment
- Runtime
- Thread

---

### Relationship Chapters

Explain how multiple components interact.

These chapters often benefit from diagrams.

Examples:

- Node.js Architecture
- Browser Rendering Pipeline
- Kubernetes Control Plane

---

### Workflow Chapters

Explain complete execution flows.

These chapters frequently combine concise text with one meaningful diagram.

Examples:

- Lambda Invocation Lifecycle
- HTTP Request Lifecycle
- OAuth Authorization Flow

---

### Integration Chapters

The final objective of a Deep Dive is to reconnect every concept introduced throughout the document.

These chapters should never introduce new knowledge.

Their purpose is to demonstrate how all previously introduced concepts interact as part of one complete system.

---

## Putting Everything Together

Every Deep Dive ends with a chapter named **Putting Everything Together**.

This chapter is not a summary.

Instead, it reconnects every concept introduced throughout the document into one complete workflow.

The chapter should answer one question:

> How do all these concepts work together in practice?

Whenever possible:

- use one comprehensive workflow diagram;
- avoid introducing new concepts;
- avoid repeating previous explanations;
- let the illustration become the primary teaching element.

The accompanying text should explain why the diagram exists, not narrate its contents.

---

## Final Perspective

The final chapter steps back from implementation details.

Its purpose is to reconnect the technology with software engineering as a whole.

Rather than explaining how the technology works, explain why it matters.

Readers should finish the document understanding not only the technology itself, but also the architectural thinking behind it.
