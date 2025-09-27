export default function ExplorePage() {
    return (
        <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-6 text-center text-[var(--ink)]">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--muted)]">Explore</p>
            <h1 className="text-4xl font-black">Curated sets soon</h1>
            <p className="max-w-sm text-sm font-medium text-[var(--muted)]">
                We&apos;re still building the discovery engine. Soon you&apos;ll be able to dig into playlists,
                trending rooms, and spotlighted comics.
            </p>
        </div>
    )
}
