export function KnowledgeCheck({
  question,
  children,
}: {
  question?: string;
  children?: React.ReactNode;
}) {
  return (
    <details className="my-8 rounded-xl border border-emerald-900/70 bg-emerald-950/20 p-5">
      <summary className="cursor-pointer text-base leading-7 font-medium text-emerald-200">
        {question ?? 'Check your understanding'}
      </summary>
      <div className="mt-4 text-zinc-300">{children}</div>
    </details>
  );
}
