# Engineering Knowledge Base

A personal reference for backend engineering, built with Next.js, TypeScript, Tailwind CSS, and Markdown.

## Explore and read

The home page shows nine knowledge areas. Categories open subcategories and readings; each reading has one canonical home, prerequisites, and related entries across areas. The global search finds titles and text inside both Overview and Deep Dive. Planned entries have roadmap pages, not placeholder lessons.

Existing `/docs/...` links remain valid. Available readings keep their original Markdown and images. A reading's estimate includes both parts and time to inspect images; estimates above 40 minutes are flagged rather than capped. Rewriting the lessons to meet that editorial target is separate work.

The reader includes breadcrumbs, Overview/Deep Dive navigation, an anchored table of contents, and a saved reading position. Progress stays in this browser's local storage, requires no account, and does not imply mastery or change editorial status. Use “Resume saved section” or “Continue reading” on the home page. Reading remains available when browser storage is disabled.

## Development

Use Node.js 22.18+ (Node.js 24 recommended).

```bash
npm ci
npm run dev
```

```bash
npm run validate:catalog
npm test
npm run lint
npm run typecheck
npm run build
```

## Content and catalog

`lib/catalog/catalog.json` defines navigation independently from physical content folders:

- `categories`: stable `id`, display title, description, parent, order, and tags used for cross-area discovery.
- `topics`: stable `id`, canonical category, title, description, `contentPath`, icon, explicit status, tags, priority order, prerequisites, and related topic IDs.
- `concepts`: the primary owner and applications of shared knowledge. Teach the general explanation once and link from technology-specific applications.

Status is `planned` (no content yet), `review` (available but needs editorial work), or `complete`. Icons identify topics and never determine status at runtime. Initial statuses preserve the earlier audit's editorial classification; they do not certify technical accuracy.

The catalog contains 57 readings: 29 available and 28 planned (20 technologies/tools and eight foundations). Categories do not count as readings. Grouped entries such as npm/pnpm and ECS/ECR intentionally count as one reading each.

### Add or reorganize a reading

1. Add/update its catalog record. Use one canonical category; use tags/relations for other contexts.
2. For available content, point `contentPath` at a directory under `content/` containing `overview.md` and `deep-dive.md`. Preserve existing paths when reorganizing the menu.
3. Add images under `public/docs/` and optional icons under `public/icons/`. The catalog icon controls the menu; frontmatter remains content metadata.
4. Register shared concepts with one owner. A planned owner must remain visibly marked as planned when linked.
5. Aim for 30–35 minutes including code and images, with a 40-minute maximum for the combined reading. Estimates use 180 words/minute plus 18 seconds per image and need human review, especially for code-heavy material.
6. Run catalog validation, tests, lint, type checking, and build.

The validator checks duplicate IDs and content paths, category and prerequisite cycles, references, Markdown/icon/image paths, and coverage of every existing Overview. Tests verify search behavior, heading/TOC anchor agreement, and uncapped reading estimates.

See [CATALOG.md](CATALOG.md) for the navigation and ownership conventions.
