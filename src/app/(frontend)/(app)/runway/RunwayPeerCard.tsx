import Link from "next/link";

export type RunwayPeerBenchmark = {
  available: boolean;
  message?: string;
  you: number | null;
  median: number | null;
  best: number | null;
  cohortSize: number | null;
  percentileRank: number | null;
};

export function RunwayPeerCard({ peer }: { peer: RunwayPeerBenchmark }) {
  return (
    <div className="rounded-[6px] border border-rule bg-surface-1 p-4 md:p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-display text-[16px] text-ink">Peer position</h2>
        <Link
          href="/benchmarks"
          className="text-[12px] text-accent hover:text-accent-hover"
        >
          Compare
        </Link>
      </div>
      {!peer.available || peer.median === null ? (
        <p className="text-[13px] text-ink-muted">
          {peer.message ??
            "Peer cohorts appear when eight or more organisations share your sector."}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["You", peer.you],
                ["Median", peer.median],
                ["Best", peer.best],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  {label}
                </p>
                <p className="mt-1 font-data text-[15px] text-ink">
                  {value === null ? "—" : value.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-ink-muted">
            {peer.cohortSize !== null ? `${peer.cohortSize} orgs` : "Cohort"}
            {peer.percentileRank !== null
              ? ` · ~${peer.percentileRank}th percentile`
              : ""}
            {" · names never shown"}
          </p>
        </>
      )}
    </div>
  );
}
