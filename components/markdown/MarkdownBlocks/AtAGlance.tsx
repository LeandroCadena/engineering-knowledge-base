type AtAGlanceProps = {
    children?: React.ReactNode;
};

export function AtAGlance({ children }: AtAGlanceProps) {
    return (
        <section className="my-8 rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
            <h3 className="mb-4 text-sm font-semibold tracking-wide text-zinc-400 uppercase">
                At a Glance
            </h3>

            <div className="text-zinc-300">{children}</div>
        </section>
    );
}
