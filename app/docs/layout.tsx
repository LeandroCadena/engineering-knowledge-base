import { DocsLayout } from '@/components/layout/docs-layout';

type LayoutProps = {
    children: React.ReactNode;
};

export default function Layout({ children }: LayoutProps) {
    return <DocsLayout>{children}</DocsLayout>;
}