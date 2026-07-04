import matter from 'gray-matter';

export type DocumentMetadata = {
  title?: string;
  description?: string;
  order?: number;
  updatedAt?: string;
};

export function getMarkdownMetadata(markdown: string) {
  const { data, content } = matter(markdown);

  return {
    metadata: data as DocumentMetadata,
    content,
  };
}
