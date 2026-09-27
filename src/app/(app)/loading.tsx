/**
 * Loading skeleton — Section 10.1.
 *
 * Shapes echo the card catalogue rather than being generic grey bars, so the
 * page does not visibly jump when the real content replaces them.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="max-w-[68ch]">
      <span className="sr-only">Loading</span>

      <div className="h-7 w-56 animate-pulse rounded-sm bg-rule" />
      <div className="mt-2 h-4 w-32 animate-pulse rounded-sm bg-rule" />

      <div className="mt-6 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-sm border border-rule bg-card p-4">
            <div className="h-4 w-2/3 animate-pulse rounded-sm bg-rule" />
            <div className="mt-2 h-3 w-1/3 animate-pulse rounded-sm bg-rule" />
          </div>
        ))}
      </div>
    </div>
  );
}
