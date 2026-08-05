/**
 * Offset claim disclosure guards — pure, zero I/O.
 * Retired lots without serial/registry are incomplete claims (not silent failures).
 */

export type ClaimLotInput = {
  id?: string;
  label?: string | null;
  status: "held" | "retired";
  volumeTco2e: number | null;
  registryName?: string | null;
  serial?: string | null;
  projectName?: string | null;
  projectId?: string | null;
  methodology?: string | null;
};

export type ClaimIssue = {
  lotId: string | null;
  label: string;
  code: "missing_serial" | "missing_registry" | "missing_project";
  message: string;
};

export type ClaimDisclosureGuard = {
  retiredCount: number;
  completeClaimCount: number;
  incompleteClaimCount: number;
  claimQuality: "complete" | "incomplete" | "none";
  issues: ClaimIssue[];
  message: string | null;
};

export function evaluateClaimDisclosure(lots: ClaimLotInput[]): ClaimDisclosureGuard {
  const issues: ClaimIssue[] = [];
  let retiredCount = 0;
  let completeClaimCount = 0;

  for (const lot of lots) {
    if (lot.status !== "retired") continue;
    retiredCount += 1;
    const label =
      (lot.label && lot.label.trim()) ||
      lot.projectName?.trim() ||
      lot.id ||
      "Retired lot";
    const registry = lot.registryName?.trim() ?? "";
    const serial = lot.serial?.trim() ?? "";
    const project = lot.projectName?.trim() ?? "";
    let incomplete = false;

    if (!registry) {
      incomplete = true;
      issues.push({
        lotId: lot.id ?? null,
        label,
        code: "missing_registry",
        message: "Retired claim lacks registry / programme name.",
      });
    }
    if (!serial) {
      incomplete = true;
      issues.push({
        lotId: lot.id ?? null,
        label,
        code: "missing_serial",
        message: "Retired claim lacks registry serial / batch id.",
      });
    }
    if (!project) {
      incomplete = true;
      issues.push({
        lotId: lot.id ?? null,
        label,
        code: "missing_project",
        message: "Retired claim lacks project name (recommended for disclosure).",
      });
    }
    if (!incomplete) completeClaimCount += 1;
  }

  const incompleteClaimCount = retiredCount - completeClaimCount;
  if (retiredCount === 0) {
    return {
      retiredCount: 0,
      completeClaimCount: 0,
      incompleteClaimCount: 0,
      claimQuality: "none",
      issues: [],
      message: "No retired lots — nothing to claim against residual yet.",
    };
  }

  return {
    retiredCount,
    completeClaimCount,
    incompleteClaimCount,
    claimQuality: incompleteClaimCount > 0 ? "incomplete" : "complete",
    issues,
    message:
      incompleteClaimCount > 0
        ? `${incompleteClaimCount} of ${retiredCount} retired lot(s) have incomplete claim fields (serial, registry, and/or project). Residual math still runs; do not publish an offset claim until complete.`
        : `All ${retiredCount} retired lot(s) include registry, serial, and project name.`,
  };
}

export type OffsetClaimPack = {
  generatedAt: string;
  periodLabel: string;
  plainText: string;
  csv: string;
};

export function buildOffsetClaimPack(input: {
  lots: ClaimLotInput[];
  residualTco2e: number | null;
  retiredOffsetsTco2e: number;
  periodLabel?: string | null;
  generatedAt?: string;
}): OffsetClaimPack {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const periodLabel = input.periodLabel?.trim() || "all periods";
  const guard = evaluateClaimDisclosure(input.lots);

  const lines: string[] = [
    "ClearESG — Carbon credit claim / residual disclosure pack",
    `Period: ${periodLabel}`,
    `Generated: ${generatedAt}`,
    "",
    "ClearESG is not a credit marketplace and does not sync paid registries.",
    "Only retired volume may be claimed against residual. Held volume stays inventory.",
    "",
    `Residual (tCO₂e): ${input.residualTco2e == null ? "missing" : String(input.residualTco2e)}`,
    `Retired offsets (tCO₂e): ${input.retiredOffsetsTco2e}`,
    `Claim quality: ${guard.claimQuality}`,
    guard.message ? `Guard: ${guard.message}` : "",
    "",
    "## Retired lots",
  ];

  const retired = input.lots.filter((l) => l.status === "retired");
  if (retired.length === 0) {
    lines.push("(none)");
  } else {
    for (const lot of retired) {
      lines.push(
        `- ${lot.label ?? lot.id ?? "lot"} · ${lot.volumeTco2e ?? "—"} tCO₂e · registry=${lot.registryName ?? "—"} · serial=${lot.serial ?? "—"} · project=${lot.projectName ?? "—"} (${lot.projectId ?? "—"}) · methodology=${lot.methodology ?? "—"}`,
      );
    }
  }

  if (guard.issues.length) {
    lines.push("", "## Issues");
    for (const issue of guard.issues) {
      lines.push(`- [${issue.code}] ${issue.label}: ${issue.message}`);
    }
  }

  const header =
    "label,status,volumeTco2e,registryName,serial,projectName,projectId,methodology";
  const csvRows = input.lots.map((l) =>
    [
      csvEscape(l.label ?? l.id ?? ""),
      l.status,
      l.volumeTco2e == null ? "" : String(l.volumeTco2e),
      csvEscape(l.registryName ?? ""),
      csvEscape(l.serial ?? ""),
      csvEscape(l.projectName ?? ""),
      csvEscape(l.projectId ?? ""),
      csvEscape(l.methodology ?? ""),
    ].join(","),
  );

  return {
    generatedAt,
    periodLabel,
    plainText: lines.filter(Boolean).join("\n"),
    csv: [header, ...csvRows].join("\n"),
  };
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
