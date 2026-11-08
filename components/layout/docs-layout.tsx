type DocsLayoutProps = { children: React.ReactNode };
export function DocsLayout({ children }: DocsLayoutProps) {
  return <main className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8">{children}</main>;
}
