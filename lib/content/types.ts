export type ContentDocument = {
  type: 'document';
  slug: string;
  title: string;
  icon?: string;
  fileName: string;
  path: string[];
};

export type ContentDirectory = {
  type: 'directory';
  slug: string;
  title: string;
  path: string[];
  children: ContentNavigationNode[];
};

export type ContentNavigationNode = ContentDirectory | ContentDocument;
