Tech From Zero — Documentation Creation Guidelines

This document describes the methodology used to create every new technology within the Tech From Zero knowledge base.

Its purpose is not to define how technologies work, but to define how they should be documented.

The Writing Guidelines document remains the source of truth for writing philosophy, learning progression, concept classification, and visual communication.

This document explains the workflow for creating a new technology.

Workflow

Every new technology should be created using the following workflow.

Never skip steps.

Each step depends on the previous one.

Step 1 — Analyze the Technology

Before writing anything, identify what the technology actually introduces.

The objective is not to list features from the official documentation.

Instead, identify:

its responsibility;
the problem it solves;
its core concepts;
its execution model;
the objects it introduces;
the behaviors it modifies;
the architectural ideas unique to that technology.

Only after understanding the technology should the document structure be proposed.

Step 2 — Design the Overview

The Overview always follows the structure defined in the Writing Guidelines.

Each section has a different purpose.

Definition

Explain:

what the technology is;
why it exists;
its responsibility;
what it is not.

Readers should understand why the technology exists before learning how it works.

How It Works

Explain the technology from a high level.

Describe the major concepts involved without explaining their internal behavior.

Readers should recognize the vocabulary that will later appear in the Deep Dive.

Avoid implementation details.

Avoid APIs.

Avoid configuration.

Avoid advanced workflows.

How It Fits into the Ecosystem

Explain where the technology fits inside real software systems.

Show:

what communicates with it;
what depends on it;
what problems it solves.

Readers should understand where the technology belongs.

What It Looks Like

Whenever possible, include screenshots.

Readers should recognize the technology immediately when they encounter it professionally.

Use real interfaces instead of illustrations.

Common Use Cases

Present several small production scenarios.

Each use case should explain:

the problem;
why the technology is appropriate;
the high-level workflow.

Avoid oversized architecture diagrams.

Several focused examples are usually more valuable than one large example.

Step 3 — Review the Overview

Before generating images, review the document.

Remove:

repeated explanations;
unnecessary paragraphs;
concepts that belong in the Deep Dive;
concepts that belong in another document.

The Overview should answer only high-level questions.

Step 4 — Create the Frontmatter

Every document begins with a frontmatter.

It should contain only metadata.

Typical fields include:

title
description
icon
order
updatedAt

The description should briefly explain what readers will learn.

It should not repeat the title.

Step 5 — Design the Overview Images

After the text is complete, determine which sections benefit from visual explanations.

Each image must have a single responsibility.

Images should always have a dark theme.

The proposed images should be placed where they should go with a reference like the following: ![React Component Model](/docs/react/react-component-model.png)

Typical image types include:

architecture diagrams;
execution models;
workflows;
ecosystems;
screenshots.

Do not create images simply to decorate the page.

Every image should reduce the amount of text required.

Step 6 — Design the Deep Dive

Unlike the Overview, the Deep Dive has no predefined chapter structure.

Every technology introduces different concepts.

The chapters must emerge naturally from the technology itself.

Begin by identifying every important internal concept.

Examples include:

execution environments;
image layers;
event loops;
runtimes;
indexes;
transactions;
reconciliation;
rendering pipelines.

Do not group unrelated concepts simply because they are similar.

Each chapter should answer one architectural question.

Arrange chapters so that each one prepares readers for the next.

Step 7 — Define the Visual Strategy

Before writing the Deep Dive, determine how every concept will be taught.

Each concept should use the medium that teaches it most effectively.

Possible formats include:

text only;
diagram only;
text plus diagram;
text plus cheat sheet.

Avoid combining every format unnecessarily.

Step 8 — Create Architecture Diagrams

Architecture diagrams explain relationships.

Typical examples include:

component interactions;
execution pipelines;
request lifecycles;
distributed systems;
resource allocation;
internal architecture;
execution flows.

Architecture diagrams should replace paragraphs.

Do not narrate the diagram inside the text.

Step 9 — Create Cheat Sheets

Cheat sheets summarize information that readers frequently need to reference.

Typical contents include:

commands;
syntax;
keywords;
operators;
configuration options;
lifecycle states;
CLI references;
comparison tables.

A cheat sheet should eliminate the need for long textual lists.

Do not repeat its contents elsewhere.

Step 10 — Write the Deep Dive

Write each chapter independently.

Each chapter should teach one concept.

Every paragraph should introduce new understanding.

Do not summarize previous chapters.

Do not anticipate future chapters.

Do not include filler sentences.

Allow readers to naturally build a mental model.

Step 11 — Review for Redundancy

Before generating images, review the entire document.

Ask:

Does this paragraph repeat another paragraph?
Does this paragraph explain what the image already explains?
Does this diagram duplicate another diagram?
Does this cheat sheet repeat information already written?
Can this section be shorter without reducing understanding?

Remove everything that does not increase understanding.

Step 12 — Generate Images

Generate images one at a time.

Every image should use the same visual language.

Requirements:

dark theme;
black or dark navy background;
professional infographic style;
neon accents;
consistent typography;
consistent iconography;
clean spacing;
high information density.

Images should feel like they belong to the same book.

Step 13 — Putting Everything Together

Every Deep Dive ends with a chapter named Putting Everything Together.

This chapter has one objective:

Reconnect every concept introduced throughout the document.

Do not introduce new knowledge.

Do not summarize previous chapters.

Instead, show how every concept works together as one complete system.

Whenever possible, use one comprehensive workflow diagram as the primary teaching element.

The accompanying text should explain the architectural significance of the complete workflow rather than narrating the diagram.

Final Review Checklist

Before considering the document complete, verify that:

Every section answers one question.
Every paragraph teaches something new.
Every image adds new understanding.
No diagram repeats another diagram.
No cheat sheet duplicates the text.
No chapter belongs in another document.
The Overview remains high level.
The Deep Dive explains internal behavior.
The final workflow reconnects every concept without introducing new ones.
The entire document builds one coherent mental model rather than a collection of isolated facts.
