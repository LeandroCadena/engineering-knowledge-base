import data from './catalog.json';

export type Status = 'planned' | 'review' | 'complete';
export type Category = {
  id: string;
  title: string;
  description: string;
  parent: string | null;
  order: number;
  tags: string[];
};
export type Topic = {
  id: string;
  title: string;
  category: string;
  description: string;
  contentPath: string | null;
  readingFile?: string;
  status: Status;
  icon: string | null;
  tags: string[];
  prerequisites: string[];
  related: string[];
  order: number;
};
export const categories: Category[] = [...data.categories].sort((a, b) => a.order - b.order);
export const topics = data.topics as Topic[];
export const concepts = data.concepts;
export const statusLabels: Record<Status, string> = {
  planned: 'Planned',
  review: 'In review',
  complete: 'Complete',
};
export const getCategory = (id: string) => categories.find((item) => item.id === id);
export const getTopic = (id: string) => topics.find((item) => item.id === id);
export const topicHref = (topic: Topic) =>
  topic.contentPath ? `/docs/${topic.contentPath}` : `/topics/${topic.id}`;
export const categoryHref = (category: Category) => `/learn/${category.id}`;
export function categoryTrail(id: string): Category[] {
  const category = getCategory(id);
  return category ? [...(category.parent ? categoryTrail(category.parent) : []), category] : [];
}
export function categoryTopics(id: string): Topic[] {
  return topics
    .filter((topic) => categoryTrail(topic.category).some((category) => category.id === id))
    .sort((a, b) => a.order - b.order);
}
export function relatedTopics(topic: Topic): Topic[] {
  return topics
    .filter(
      (other) =>
        other.id !== topic.id &&
        (topic.related.includes(other.id) ||
          other.related.includes(topic.id) ||
          topic.tags.some((tag) => other.tags.includes(tag))),
    )
    .sort((a, b) => Number(!!b.contentPath) - Number(!!a.contentPath) || a.order - b.order)
    .slice(0, 6);
}
