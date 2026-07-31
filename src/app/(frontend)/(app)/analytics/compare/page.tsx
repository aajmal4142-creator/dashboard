import { PageFrame } from "@/components/shell/PageFrame";

import { CompareClient } from "./CompareClient";

export default function AnalyticsComparePage() {
  return (
    <PageFrame
      eyebrow="Analytics"
      title="Comparison tools"
      help="YoY emissions, department / supplier / metric splits, and multi-period trends. Peer benchmarks, scenario trajectories, and TCFD year compare remain on their existing surfaces."
    >
      <CompareClient />
    </PageFrame>
  );
}
