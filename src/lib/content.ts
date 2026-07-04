export const contentCategories = [
  {
    title: 'Languages',
    slug: 'languages',
    items: [
      {
        title: 'JavaScript',
        slug: 'javascript',
        documents: [
          {
            title: 'Overview',
            slug: '01-overview',
          },
          {
            title: 'Deep Dive',
            slug: '02-deep-dive',
          },
        ],
      },
      {
        title: 'TypeScript',
        slug: 'typescript',
        documents: [],
      },
    ],
  },
  {
    title: 'Frameworks & Runtimes',
    slug: 'frameworks',
    items: [
      { title: 'Node.js', slug: 'nodejs', documents: [] },
      { title: 'Express', slug: 'express', documents: [] },
      { title: 'NestJS', slug: 'nestjs', documents: [] },
      { title: 'React', slug: 'react', documents: [] },
      { title: 'Next.js', slug: 'nextjs', documents: [] },
    ],
  },
  {
    title: 'Architecture',
    slug: 'architecture',
    items: [
      { title: 'Microservices', slug: 'microservices', documents: [] },
      { title: 'SOLID', slug: 'solid', documents: [] },
      { title: 'Clean Architecture', slug: 'clean-architecture', documents: [] },
    ],
  },
  {
    title: 'Cloud',
    slug: 'cloud',
    items: [
      { title: 'AWS', slug: 'aws', documents: [] },
      { title: 'Azure', slug: 'azure', documents: [] },
    ],
  },
  {
    title: 'Infrastructure',
    slug: 'infrastructure',
    items: [
      { title: 'Docker', slug: 'docker', documents: [] },
      { title: 'Kubernetes', slug: 'kubernetes', documents: [] },
      { title: 'Terraform', slug: 'terraform', documents: [] },
    ],
  },
  {
    title: 'Databases',
    slug: 'databases',
    items: [
      { title: 'PostgreSQL', slug: 'postgresql', documents: [] },
      { title: 'MongoDB', slug: 'mongodb', documents: [] },
      { title: 'Redis', slug: 'redis', documents: [] },
    ],
  },
  {
    title: 'AI',
    slug: 'ai',
    items: [
      { title: 'RAG', slug: 'rag', documents: [] },
      { title: 'MCP', slug: 'mcp', documents: [] },
      { title: 'LangChain', slug: 'langchain', documents: [] },
      { title: 'AI Agents', slug: 'ai-agents', documents: [] },
    ],
  },
  {
    title: 'DevOps',
    slug: 'devops',
    items: [
      { title: 'Git', slug: 'git', documents: [] },
      { title: 'GitHub Actions', slug: 'github-actions', documents: [] },
      { title: 'CI/CD', slug: 'ci-cd', documents: [] },
    ],
  },
] as const;