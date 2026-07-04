export type ContentDocument = {
  slug: string;
  title: string;
  fileName: string;
};

export type ContentTechnology = {
  slug: string;
  title: string;
  documents: ContentDocument[];
};

export type ContentCategory = {
  slug: string;
  title: string;
  technologies: ContentTechnology[];
};
