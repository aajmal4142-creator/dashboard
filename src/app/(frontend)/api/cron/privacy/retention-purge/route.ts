import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { isProductionRuntime, retentionPurgeLive } from "@/lib/launch/gates";
import config from "@/payload.config";

type OrgReport = {
  organisationId: string;
  organisationName: string;
  datapoints: { retentionDays: number; matched: number; deleted: number };
  evidence: { retentionDays: number; matched: number; deleted: number };
};

/**
 * Retention purge — DPDP Act product beachhead (Y06). Open decision §11:
 * hosting region / Atlas is not yet chosen, so this route is a dry-run
 * report by default. It never deletes production data unless an operator
 * explicitly sets CLEARESG_RETENTION_PURGE_LIVE=1 (see docs/LAUNCH_DECISIONS.md).
 *
 * When wiring this up for real:
 *   - Confirm the §11 hosting region / Atlas decision first.
 *   - Consider soft-delete / archive-then-delete instead of a hard delete.
 *   - Exclude datapoints referenced by a locked/published report (audit trail).
 *   - Run dry-run in production for at least one full cycle before flipping
 *     CLEARESG_RETENTION_PURGE_LIVE=1, and alert on the report below.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (isProductionRuntime()) {
    if (!secret) {
      return NextResponse.json(
        { error: "CRON_SECRET required in production" },
        { status: 503 },
      );
    }
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const live = retentionPurgeLive();

  try {
    const payload = await getPayload({ config });
    const orgs = await payload.find({
      collection: "organisations",
      where: { "settings.privacy.dpdEnabled": { equals: true } },
      depth: 0,
      limit: 500,
      overrideAccess: true,
    });

    const reports: OrgReport[] = [];

    for (const org of orgs.docs) {
      const datapointsDays = org.settings?.privacy?.retentionDays?.datapoints ?? null;
      const evidenceDays = org.settings?.privacy?.retentionDays?.evidence ?? null;
      if (!datapointsDays && !evidenceDays) continue;

      const report: OrgReport = {
        organisationId: org.id,
        organisationName: org.name,
        datapoints: { retentionDays: datapointsDays ?? 0, matched: 0, deleted: 0 },
        evidence: { retentionDays: evidenceDays ?? 0, matched: 0, deleted: 0 },
      };

      if (datapointsDays && datapointsDays > 0) {
        const cutoff = new Date(
          Date.now() - datapointsDays * 24 * 60 * 60 * 1000,
        ).toISOString();
        const matches = await payload.find({
          collection: "datapoints",
          where: {
            and: [
              { organisation: { equals: org.id } },
              { createdAt: { less_than: cutoff } },
            ],
          },
          depth: 0,
          limit: 0,
          overrideAccess: true,
        });
        report.datapoints.matched = matches.totalDocs;

        if (live) {
          // Real deletion only runs once CLEARESG_RETENTION_PURGE_LIVE=1 is set.
          // Kept as a comment-first stub: fetch IDs in pages and delete deliberately
          // rather than a single unbounded bulk delete, so a bad cutoff can be aborted.
          // const toDelete = await payload.find({ collection: "datapoints", where: ..., limit: 500, overrideAccess: true });
          // for (const doc of toDelete.docs) { await payload.delete({ collection: "datapoints", id: doc.id, overrideAccess: true }); report.datapoints.deleted += 1; }
        }
      }

      if (evidenceDays && evidenceDays > 0) {
        const cutoff = new Date(
          Date.now() - evidenceDays * 24 * 60 * 60 * 1000,
        ).toISOString();
        const matches = await payload.find({
          collection: "evidence",
          where: {
            and: [
              { organisation: { equals: org.id } },
              { createdAt: { less_than: cutoff } },
            ],
          },
          depth: 0,
          limit: 0,
          overrideAccess: true,
        });
        report.evidence.matched = matches.totalDocs;

        if (live) {
          // Same deliberate, paged-delete stub as datapoints above — intentionally
          // left commented out until §11 (hosting region / Atlas) is confirmed.
        }
      }

      reports.push(report);
    }

    return NextResponse.json({
      ok: true,
      mode: live ? "live" : "dry_run",
      note: live
        ? "CLEARESG_RETENTION_PURGE_LIVE=1 — deletion logic is still commented out pending §11 sign-off."
        : "Dry run — no records were deleted. Set CLEARESG_RETENTION_PURGE_LIVE=1 only after the §11 hosting decision.",
      organisationsScanned: orgs.totalDocs,
      reports,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Retention purge cron failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
