type ExampleProps = {
    children?: React.ReactNode;
};

export function Example({ children }: ExampleProps) {
    return (
        <details className="my-8 rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
            <summary className="cursor-pointer text-sm font-semibold tracking-wide text-zinc-400 uppercase">
                Show Example
            </summary>

            <div className="mt-4 text-zinc-300">{children}</div>
        </details>
    );
}
