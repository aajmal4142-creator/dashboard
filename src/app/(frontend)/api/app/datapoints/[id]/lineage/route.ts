import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import {
  layoutLineageGraph,
  lineageDownloadFilename,
  lineageLayoutToSvg,
  lineageToJson,
} from "@/lib/data/lineage";
import { loadDatapointLineage } from "@/lib/data/lineage/load";
import config from "@/payload.config";

type Props = { params: Promise<{ id: string }> };

/**
 * GET /api/app/datapoints/[id]/lineage
 * Query: ?format=json|svg (optional download) — default JSON body with graph + layout.
 */
export async function GET(req: Request, { params }: Props) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const payload = await getPayload({ config });

  let graph;
  try {
    graph = await loadDatapointLineage(payload, {
      organisationId: ctx.activeOrg.id,
      datapointId: id,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // Payload findByID throws when missing
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const format = url.searchParams.get("format");
  const layout = layoutLineageGraph(graph);

  if (format === "json") {
    return new NextResponse(lineageToJson(graph), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${lineageDownloadFilename(graph.metricKey, "json")}"`,
      },
    });
  }

  if (format === "svg") {
    const svg = lineageLayoutToSvg(
      layout,
      `Lineage · ${graph.metricLabel ?? graph.metricKey}`,
    );
    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${lineageDownloadFilename(graph.metricKey, "svg")}"`,
      },
    });
  }

  return NextResponse.json({
    datapointId: id,
    graph,
    layout: {
      width: layout.width,
      height: layout.height,
      nodes: layout.nodes,
      edges: layout.edges,
    },
  });
}
