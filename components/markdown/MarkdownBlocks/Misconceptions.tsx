type MisconceptionsProps = {
    children?: React.ReactNode;
};

export function Misconceptions({ children }: MisconceptionsProps) {
    return (
        <section className="my-8 rounded-xl border border-amber-900/50 bg-amber-950/20 p-5">
            <h3 className="mb-4 text-sm font-semibold tracking-wide text-amber-400 uppercase">
                Common Misconceptions
            </h3>

            <div className="text-zinc-300">{children}</div>
        </section>
    );
}
