"use client";

import { useCallback, useEffect, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { Calculator, Pencil, Plus, Trash2, X } from "lucide-react";

import {
  EmptyState,
  PageFrame,
  PageSkeleton,
  StatusLine,
} from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { AppField, AppSelectNative } from "@/components/ui/AppField";
import {
  PRODUCT_FOOTPRINT_STATUSES,
  PRODUCT_FOOTPRINT_UNITS,
  PRODUCT_TRANSPORT_MODES,
  type PeriodOption,
  type ProductFootprintDto,
  type ProductFootprintStatus,
  type ProductFootprintUnit,
  type ProductTransportMode,
} from "@/lib/products";
import { cn } from "@/lib/utils";

type ListPayload = {
  products: ProductFootprintDto[];
  periods: PeriodOption[];
  canWrite?: boolean;
  canDelete?: boolean;
  error?: string;
};

type BomFormRow = {
  material: string;
  quantity: string;
  unit: string;
  supplierEmissionFactor: string;
};

type SourceFormRow = {
  source: string;
  quantity: string;
  unit: string;
  emissionsFactor: string;
};

type FormState = {
  productName: string;
  sku: string;
  category: string;
  description: string;
  unit: ProductFootprintUnit;
  periodId: string;
  status: ProductFootprintStatus;
  billOfMaterials: BomFormRow[];
  emissionsSources: SourceFormRow[];
  primaryPackaging: string;
  primaryWeight: string;
  secondaryPackaging: string;
  secondaryWeight: string;
  totalPackagingEmissions: string;
  transportOrigin: string;
  transportDestination: string;
  transportDistance: string;
  transportMode: ProductTransportMode | "";
  transportEmissionsFactor: string;
  transportUnitsShipped: string;
  emissionsFromDecomposition: string;
  recyclingBenefit: string;
};

function emptyBom(): BomFormRow {
  return { material: "", quantity: "", unit: "kg", supplierEmissionFactor: "" };
}

function emptySource(): SourceFormRow {
  return { source: "", quantity: "", unit: "kWh", emissionsFactor: "" };
}

function emptyForm(periodId = ""): FormState {
  return {
    productName: "",
    sku: "",
    category: "",
    description: "",
    unit: "per_unit",
    periodId,
    status: "draft",
    billOfMaterials: [emptyBom()],
    emissionsSources: [],
    primaryPackaging: "",
    primaryWeight: "",
    secondaryPackaging: "",
    secondaryWeight: "",
    totalPackagingEmissions: "",
    transportOrigin: "",
    transportDestination: "",
    transportDistance: "",
    transportMode: "",
    transportEmissionsFactor: "",
    transportUnitsShipped: "1",
    emissionsFromDecomposition: "",
    recyclingBenefit: "",
  };
}

function formatNum(n: number | null | undefined, digits = 3): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("font-[family-name:var(--font-mono)] tabular-nums", className)}>
      {children}
    </span>
  );
}

function statusClass(status: ProductFootprintStatus): string {
  if (status === "verified") return "text-[color:var(--signal)]";
  if (status === "published") return "text-[color:var(--cobalt)]";
  if (status === "superseded") return "text-[color:var(--ink-muted)]";
  return "text-[color:var(--amber)]";
}

function qualityClass(quality: ProductFootprintDto["quality"]): string {
  if (quality === "calculated" || quality === "measured") {
    return "text-[color:var(--signal)]";
  }
  if (quality === "estimated") return "text-[color:var(--amber)]";
  return "text-[color:var(--rust)]";
}

function optionalNum(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : Number.NaN;
}

const STATUS_LABELS: Record<ProductFootprintStatus, string> = {
  draft: "Draft",
  published: "Published",
  verified: "Verified",
  superseded: "Superseded",
};

const UNIT_LABELS: Record<ProductFootprintUnit, string> = {
  per_unit: "Per unit",
  per_kg: "Per kg",
  per_liter: "Per liter",
  per_service: "Per service",
};

const MODE_LABELS: Record<ProductTransportMode, string> = {
  ocean: "Ocean",
  air: "Air",
  truck: "Truck",
  rail: "Rail",
};

export function ProductFootprintsClient(props: {
  orgName: string;
  canWrite: boolean;
  canDelete: boolean;
  eyebrow: string;
  title: string;
  help: string;
}) {
  const [payload, setPayload] = useState<ListPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [periodFilter, setPeriodFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [calcPending, setCalcPending] = useState(false);
  const [calcMessage, setCalcMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    startTransition(async () => {
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (periodFilter) qs.set("periodId", periodFilter);
        if (statusFilter) qs.set("status", statusFilter);
        const suffix = qs.toString() ? `?${qs.toString()}` : "";
        const res = await fetch(`/api/app/analytics/product-footprints${suffix}`);
        const json = (await res.json()) as ListPayload;
        if (!res.ok) {
          setError(json.error ?? "Could not load product footprints");
          setPayload(null);
          return;
        }
        setPayload(json);
        if (selectedId && !json.products.some((p) => p.id === selectedId)) {
          setSelectedId(null);
        }
      } catch {
        setError("Network error loading product footprints. Retry.");
        setPayload(null);
      }
    });
  }, [periodFilter, statusFilter, selectedId]);

  useEffect(() => {
    load();
  }, [load]);

  const canWrite = payload?.canWrite ?? props.canWrite;
  const canDelete = payload?.canDelete ?? props.canDelete;
  const selected = payload?.products.find((p) => p.id === selectedId) ?? null;
  const periods = payload?.periods ?? [];

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm(periodFilter || periods[0]?.id || ""));
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(product: ProductFootprintDto) {
    setEditingId(product.id);
    setForm({
      productName: product.productName,
      sku: product.sku,
      category: product.category,
      description: product.description ?? "",
      unit: product.unit,
      periodId: product.periodId ?? "",
      status: product.status,
      billOfMaterials:
        product.billOfMaterials.length > 0
          ? product.billOfMaterials.map((line) => ({
              material: line.material,
              quantity: String(line.quantity),
              unit: line.unit,
              supplierEmissionFactor:
                line.supplierEmissionFactor === null
                  ? ""
                  : String(line.supplierEmissionFactor),
            }))
          : [emptyBom()],
      emissionsSources: product.emissionsSources.map((line) => ({
        source: line.source,
        quantity: String(line.quantity),
        unit: line.unit,
        emissionsFactor: String(line.emissionsFactor),
      })),
      primaryPackaging: product.primaryPackaging ?? "",
      primaryWeight: product.primaryWeight === null ? "" : String(product.primaryWeight),
      secondaryPackaging: product.secondaryPackaging ?? "",
      secondaryWeight:
        product.secondaryWeight === null ? "" : String(product.secondaryWeight),
      totalPackagingEmissions:
        product.totalPackagingEmissions === null
          ? ""
          : String(product.totalPackagingEmissions),
      transportOrigin: product.transportOrigin ?? "",
      transportDestination: product.transportDestination ?? "",
      transportDistance:
        product.transportDistance === null ? "" : String(product.transportDistance),
      transportMode: product.transportMode ?? "",
      transportEmissionsFactor:
        product.transportEmissionsFactor === null
          ? ""
          : String(product.transportEmissionsFactor),
      transportUnitsShipped:
        product.transportUnitsShipped === null
          ? "1"
          : String(product.transportUnitsShipped),
      emissionsFromDecomposition:
        product.emissionsFromDecomposition === null
          ? ""
          : String(product.emissionsFromDecomposition),
      recyclingBenefit:
        product.recyclingBenefit === null ? "" : String(product.recyclingBenefit),
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function saveProduct() {
    setFormError(null);
    if (!form.productName.trim() || !form.sku.trim() || !form.category.trim()) {
      setFormError("Product name, SKU, and category are required.");
      return;
    }

    const billOfMaterials = [];
    for (const row of form.billOfMaterials) {
      if (
        !row.material.trim() &&
        !row.quantity.trim() &&
        !row.supplierEmissionFactor.trim()
      ) {
        continue;
      }
      const quantity = optionalNum(row.quantity);
      const factor = optionalNum(row.supplierEmissionFactor);
      if (!row.material.trim() || !row.unit.trim()) {
        setFormError("Each BOM line needs material and unit.");
        return;
      }
      if (quantity === null || Number.isNaN(quantity) || quantity < 0) {
        setFormError("Each BOM line needs a non-negative quantity.");
        return;
      }
      if (factor !== null && Number.isNaN(factor)) {
        setFormError("BOM emission factors must be numbers when set.");
        return;
      }
      billOfMaterials.push({
        material: row.material.trim(),
        quantity,
        unit: row.unit.trim(),
        supplierEmissionFactor: factor,
        factorSource: factor === null ? null : ("custom" as const),
      });
    }

    const emissionsSources = [];
    for (const row of form.emissionsSources) {
      if (!row.source.trim() && !row.quantity.trim() && !row.emissionsFactor.trim()) {
        continue;
      }
      const quantity = optionalNum(row.quantity);
      const factor = optionalNum(row.emissionsFactor);
      if (!row.source.trim() || !row.unit.trim()) {
        setFormError("Each production source needs a name and unit.");
        return;
      }
      if (quantity === null || Number.isNaN(quantity) || quantity < 0) {
        setFormError("Each production source needs a non-negative quantity.");
        return;
      }
      if (factor === null || Number.isNaN(factor) || factor < 0) {
        setFormError("Each production source needs a non-negative emissions factor.");
        return;
      }
      emissionsSources.push({
        source: row.source.trim(),
        quantity,
        unit: row.unit.trim(),
        emissionsFactor: factor,
      });
    }

    const numFields: Array<[string, string]> = [
      ["primaryWeight", form.primaryWeight],
      ["secondaryWeight", form.secondaryWeight],
      ["totalPackagingEmissions", form.totalPackagingEmissions],
      ["transportDistance", form.transportDistance],
      ["transportEmissionsFactor", form.transportEmissionsFactor],
      ["transportUnitsShipped", form.transportUnitsShipped],
      ["emissionsFromDecomposition", form.emissionsFromDecomposition],
      ["recyclingBenefit", form.recyclingBenefit],
    ];
    const numbers: Record<string, number | null> = {};
    for (const [key, raw] of numFields) {
      const n = optionalNum(raw);
      if (n !== null && Number.isNaN(n)) {
        setFormError(`${key} must be a number.`);
        return;
      }
      if (key !== "recyclingBenefit" && n !== null && n < 0) {
        setFormError(`${key} must be non-negative.`);
        return;
      }
      numbers[key] = n;
    }

    const body = {
      productName: form.productName.trim(),
      sku: form.sku.trim(),
      category: form.category.trim(),
      description: form.description.trim() || null,
      unit: form.unit,
      periodId: form.periodId.trim() || null,
      status: form.status,
      billOfMaterials,
      emissionsSources,
      primaryPackaging: form.primaryPackaging.trim() || null,
      primaryWeight: numbers.primaryWeight,
      secondaryPackaging: form.secondaryPackaging.trim() || null,
      secondaryWeight: numbers.secondaryWeight,
      totalPackagingEmissions: numbers.totalPackagingEmissions,
      transportOrigin: form.transportOrigin.trim() || null,
      transportDestination: form.transportDestination.trim() || null,
      transportDistance: numbers.transportDistance,
      transportMode: form.transportMode || null,
      transportEmissionsFactor: numbers.transportEmissionsFactor,
      transportUnitsShipped: numbers.transportUnitsShipped,
      emissionsFromDecomposition: numbers.emissionsFromDecomposition,
      recyclingBenefit: numbers.recyclingBenefit,
    };

    const res = await fetch(
      editingId
        ? `/api/app/analytics/product-footprints/${editingId}`
        : "/api/app/analytics/product-footprints",
      {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      product?: ProductFootprintDto;
    };
    if (!res.ok) {
      setFormError(json.error ?? "Could not save product.");
      return;
    }
    setFormOpen(false);
    if (json.product) setSelectedId(json.product.id);
    setCalcMessage(null);
    load();
  }

  async function deleteProduct(id: string) {
    if (!canDelete) return;
    if (!window.confirm("Delete this product footprint? This cannot be undone.")) {
      return;
    }
    const res = await fetch(`/api/app/analytics/product-footprints/${id}`, {
      method: "DELETE",
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Could not delete product.");
      return;
    }
    if (selectedId === id) setSelectedId(null);
    load();
  }

  async function calculateSelected() {
    if (!selected || !canWrite) return;
    setCalcPending(true);
    setCalcMessage(null);
    try {
      const res = await fetch(
        `/api/app/analytics/product-footprints/${selected.id}/calculate`,
        { method: "POST" },
      );
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        result?: { totalTco2e: number; quality: string };
      };
      if (!res.ok) {
        setCalcMessage(json.error ?? "Calculation failed.");
        return;
      }
      const t = json.result?.totalTco2e;
      const q = json.result?.quality ?? "calculated";
      setCalcMessage(
        t === undefined
          ? `Footprint quality: ${q}.`
          : `Result ${formatNum(t, 4)} tCO₂e (${q}).`,
      );
      load();
    } catch {
      setCalcMessage("Network error during calculation. Retry.");
    } finally {
      setCalcPending(false);
    }
  }

  if (!payload && !error) {
    return <PageSkeleton />;
  }

  return (
    <PageFrame
      eyebrow={props.eyebrow}
      title={props.title}
      help={props.help}
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-[color:var(--ink-muted)]">{props.orgName}</span>
          <Link
            href="/analytics"
            className="text-sm text-accent underline-offset-2 hover:underline"
          >
            Analytics
          </Link>
          <Button type="button" variant="outline" onClick={load} disabled={pending}>
            Refresh
          </Button>
          {canWrite ? (
            <Button type="button" onClick={openCreate} disabled={pending}>
              <Plus className="size-4" aria-hidden />
              New product
            </Button>
          ) : null}
        </div>
      }
    >
      {!canWrite ? (
        <StatusLine tone="neutral">
          View only — ask a contributor or admin to edit product footprints.
        </StatusLine>
      ) : null}

      {error ? (
        <StatusLine tone="error">
          {error}{" "}
          <button type="button" className="underline" onClick={load}>
            Retry
          </button>
        </StatusLine>
      ) : null}

      {calcMessage ? (
        <StatusLine
          tone={
            calcMessage.includes("failed") ||
            calcMessage.includes("Missing") ||
            calcMessage.includes("error")
              ? "error"
              : "ok"
          }
        >
          {calcMessage}
        </StatusLine>
      ) : null}

      <div className="flex flex-wrap gap-3 border-b border-[color:var(--rule)] pb-4">
        <label className="flex flex-col gap-1 text-xs text-[color:var(--ink-muted)]">
          Period
          <select
            className="min-w-[12rem] rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] px-2 py-1.5 text-sm text-[color:var(--ink)]"
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
          >
            <option value="">All periods</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[color:var(--ink-muted)]">
          Status
          <select
            className="min-w-[10rem] rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] px-2 py-1.5 text-sm text-[color:var(--ink)]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            {PRODUCT_FOOTPRINT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {payload && payload.products.length === 0 ? (
        <EmptyState
          title="No product footprints yet"
          body="Add a SKU with activity lines (BOM, production, packaging, transport). Factors are user-entered — no paid LCA database. Calculate to get tCO₂e."
        />
      ) : null}

      {payload && payload.products.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="overflow-x-auto border-t border-[color:var(--rule)]">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead>
                <tr className="border-b border-[color:var(--rule)] text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">
                  <th className="py-2 pr-3 font-medium">Product</th>
                  <th className="py-2 pr-3 font-medium">SKU</th>
                  <th className="py-2 pr-3 font-medium">tCO₂e</th>
                  <th className="py-2 pr-3 font-medium">Quality</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {payload.products.map((product) => (
                  <tr
                    key={product.id}
                    className={cn(
                      "cursor-pointer border-b border-[color:var(--rule)] transition-colors",
                      selectedId === product.id
                        ? "bg-[color:var(--surface-2)]"
                        : "hover:bg-[color:var(--surface-2)]",
                    )}
                    onClick={() => {
                      setSelectedId(product.id);
                      setCalcMessage(null);
                    }}
                  >
                    <td className="py-2.5 pr-3 text-[color:var(--ink)]">
                      {product.productName}
                    </td>
                    <td className="py-2.5 pr-3">
                      <Mono>{product.sku}</Mono>
                    </td>
                    <td className="py-2.5 pr-3">
                      <Mono>{formatNum(product.totalTco2e, 4)}</Mono>
                    </td>
                    <td
                      className={cn(
                        "py-2.5 pr-3 capitalize",
                        qualityClass(product.quality),
                      )}
                    >
                      {product.quality}
                    </td>
                    <td className={cn("py-2.5 capitalize", statusClass(product.status))}>
                      {STATUS_LABELS[product.status]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <aside className="space-y-4 border-t border-[color:var(--rule)] pt-4 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
            {!selected ? (
              <p className="text-sm text-[color:var(--ink-muted)]">
                Select a product to view footprint detail.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--ink)]">
                      {selected.productName}
                    </h2>
                    <p className="mt-1 text-sm text-[color:var(--ink-muted)]">
                      <Mono>{selected.sku}</Mono>
                      {selected.periodLabel ? ` · ${selected.periodLabel}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canWrite ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(selected)}
                        >
                          <Pencil className="size-3.5" aria-hidden />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={calculateSelected}
                          disabled={calcPending}
                        >
                          <Calculator className="size-3.5" aria-hidden />
                          {calcPending ? "Calculating…" : "Calculate"}
                        </Button>
                      </>
                    ) : null}
                    {canDelete ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => deleteProduct(selected.id)}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                        Delete
                      </Button>
                    ) : null}
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div>
                    <dt className="text-xs text-[color:var(--ink-muted)]">Total</dt>
                    <dd>
                      <Mono className="text-lg">{formatNum(selected.totalTco2e, 4)}</Mono>{" "}
                      <span className="text-[color:var(--ink-muted)]">tCO₂e</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[color:var(--ink-muted)]">Quality</dt>
                    <dd className={cn("capitalize", qualityClass(selected.quality))}>
                      {selected.quality}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[color:var(--ink-muted)]">kg CO₂e</dt>
                    <dd>
                      <Mono>{formatNum(selected.totalCarbonFootprintKg, 2)}</Mono>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[color:var(--ink-muted)]">Category</dt>
                    <dd>{selected.category}</dd>
                  </div>
                </dl>

                {selected.breakdown ? (
                  <div className="border-t border-[color:var(--rule)] pt-3">
                    <h3 className="text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">
                      Stage breakdown (kg CO₂e)
                    </h3>
                    <ul className="mt-2 space-y-1 text-sm">
                      {(
                        [
                          ["Materials", selected.breakdown.materials],
                          ["Production", selected.breakdown.production],
                          ["Packaging", selected.breakdown.packaging],
                          ["Transport", selected.breakdown.transportation],
                          ["End of life", selected.breakdown.endOfLife],
                        ] as const
                      ).map(([label, value]) => (
                        <li key={label} className="flex justify-between gap-4">
                          <span>{label}</span>
                          <Mono>{formatNum(value, 2)}</Mono>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-[color:var(--ink-muted)]">
                    No calculated result yet. Enter activity lines and run Calculate —
                    empty activity stays quality missing, not a silent zero.
                  </p>
                )}

                <div className="border-t border-[color:var(--rule)] pt-3 text-sm">
                  <p className="text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">
                    Activity
                  </p>
                  <p className="mt-1 text-[color:var(--ink-muted)]">
                    BOM lines: <Mono>{selected.billOfMaterials.length}</Mono>
                    {" · "}
                    Production sources: <Mono>{selected.emissionsSources.length}</Mono>
                  </p>
                </div>
              </>
            )}
          </aside>
        </div>
      ) : null}

      {formOpen ? (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-[color:var(--ink)]/40 p-4 pt-10">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-footprint-form-title"
            className="w-full max-w-2xl rounded-[6px] border border-[color:var(--rule-strong)] bg-[color:var(--surface-1)] p-5 shadow-lg"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2
                id="product-footprint-form-title"
                className="font-[family-name:var(--font-display)] text-xl text-[color:var(--ink)]"
              >
                {editingId ? "Edit product footprint" : "New product footprint"}
              </h2>
              <button
                type="button"
                className="rounded-[4px] p-1 text-[color:var(--ink-muted)] hover:bg-[color:var(--surface-2)]"
                onClick={() => setFormOpen(false)}
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            {formError ? <StatusLine tone="error">{formError}</StatusLine> : null}

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <AppField
                label="Product name"
                value={form.productName}
                onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))}
                required
              />
              <AppField
                label="SKU"
                value={form.sku}
                onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                required
              />
              <AppField
                label="Category"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                required
              />
              <AppSelectNative
                label="Unit"
                value={form.unit}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    unit: e.target.value as ProductFootprintUnit,
                  }))
                }
              >
                {PRODUCT_FOOTPRINT_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {UNIT_LABELS[u]}
                  </option>
                ))}
              </AppSelectNative>
              <AppSelectNative
                label="Period"
                value={form.periodId}
                onChange={(e) => setForm((f) => ({ ...f, periodId: e.target.value }))}
              >
                <option value="">No period</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </AppSelectNative>
              <AppSelectNative
                label="Status"
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    status: e.target.value as ProductFootprintStatus,
                  }))
                }
              >
                {PRODUCT_FOOTPRINT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </AppSelectNative>
              <div className="sm:col-span-2">
                <AppField
                  label="Description"
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="mt-5 border-t border-[color:var(--rule)] pt-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium text-[color:var(--ink)]">
                  Bill of materials
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      billOfMaterials: [...f.billOfMaterials, emptyBom()],
                    }))
                  }
                >
                  Add line
                </Button>
              </div>
              <div className="space-y-2">
                {form.billOfMaterials.map((row, idx) => (
                  <div key={idx} className="grid gap-2 sm:grid-cols-4">
                    <AppField
                      label={idx === 0 ? "Material" : undefined}
                      value={row.material}
                      onChange={(e) =>
                        setForm((f) => {
                          const next = [...f.billOfMaterials];
                          next[idx] = { ...next[idx], material: e.target.value };
                          return { ...f, billOfMaterials: next };
                        })
                      }
                      placeholder="Material"
                    />
                    <AppField
                      label={idx === 0 ? "Qty" : undefined}
                      value={row.quantity}
                      onChange={(e) =>
                        setForm((f) => {
                          const next = [...f.billOfMaterials];
                          next[idx] = { ...next[idx], quantity: e.target.value };
                          return { ...f, billOfMaterials: next };
                        })
                      }
                      inputMode="decimal"
                      className="font-[family-name:var(--font-mono)]"
                    />
                    <AppField
                      label={idx === 0 ? "Unit" : undefined}
                      value={row.unit}
                      onChange={(e) =>
                        setForm((f) => {
                          const next = [...f.billOfMaterials];
                          next[idx] = { ...next[idx], unit: e.target.value };
                          return { ...f, billOfMaterials: next };
                        })
                      }
                    />
                    <AppField
                      label={idx === 0 ? "Factor kgCO₂e" : undefined}
                      value={row.supplierEmissionFactor}
                      onChange={(e) =>
                        setForm((f) => {
                          const next = [...f.billOfMaterials];
                          next[idx] = {
                            ...next[idx],
                            supplierEmissionFactor: e.target.value,
                          };
                          return { ...f, billOfMaterials: next };
                        })
                      }
                      inputMode="decimal"
                      className="font-[family-name:var(--font-mono)]"
                    />
                    <div className={idx === 0 ? "pt-6" : undefined}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!row.material.trim() || pending}
                        onClick={() => {
                          void (async () => {
                            try {
                              const res = await fetch(
                                `/api/app/analytics/product-footprints/suggest-factor?material=${encodeURIComponent(row.material.trim())}`,
                              );
                              const body = (await res.json()) as {
                                found?: boolean;
                                factor?: number;
                                factorKey?: string;
                                message?: string;
                                error?: string;
                              };
                              if (!res.ok || !body.found || body.factor == null) {
                                setError(
                                  body.message ??
                                    body.error ??
                                    "No registry factor matched. Enter manually.",
                                );
                                return;
                              }
                              setForm((f) => {
                                const next = [...f.billOfMaterials];
                                next[idx] = {
                                  ...next[idx],
                                  supplierEmissionFactor: String(body.factor),
                                };
                                return { ...f, billOfMaterials: next };
                              });
                              setError(null);
                            } catch {
                              setError("Could not suggest factor from registry.");
                            }
                          })();
                        }}
                      >
                        Suggest
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 border-t border-[color:var(--rule)] pt-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium text-[color:var(--ink)]">
                  Production sources
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      emissionsSources: [...f.emissionsSources, emptySource()],
                    }))
                  }
                >
                  Add source
                </Button>
              </div>
              {form.emissionsSources.length === 0 ? (
                <p className="text-xs text-[color:var(--ink-muted)]">
                  Optional. Electricity, heat, steam — each with quantity and factor.
                </p>
              ) : (
                <div className="space-y-2">
                  {form.emissionsSources.map((row, idx) => (
                    <div key={idx} className="grid gap-2 sm:grid-cols-4">
                      <AppField
                        label={idx === 0 ? "Source" : undefined}
                        value={row.source}
                        onChange={(e) =>
                          setForm((f) => {
                            const next = [...f.emissionsSources];
                            next[idx] = { ...next[idx], source: e.target.value };
                            return { ...f, emissionsSources: next };
                          })
                        }
                      />
                      <AppField
                        label={idx === 0 ? "Qty" : undefined}
                        value={row.quantity}
                        onChange={(e) =>
                          setForm((f) => {
                            const next = [...f.emissionsSources];
                            next[idx] = { ...next[idx], quantity: e.target.value };
                            return { ...f, emissionsSources: next };
                          })
                        }
                        inputMode="decimal"
                        className="font-[family-name:var(--font-mono)]"
                      />
                      <AppField
                        label={idx === 0 ? "Unit" : undefined}
                        value={row.unit}
                        onChange={(e) =>
                          setForm((f) => {
                            const next = [...f.emissionsSources];
                            next[idx] = { ...next[idx], unit: e.target.value };
                            return { ...f, emissionsSources: next };
                          })
                        }
                      />
                      <AppField
                        label={idx === 0 ? "Factor" : undefined}
                        value={row.emissionsFactor}
                        onChange={(e) =>
                          setForm((f) => {
                            const next = [...f.emissionsSources];
                            next[idx] = {
                              ...next[idx],
                              emissionsFactor: e.target.value,
                            };
                            return { ...f, emissionsSources: next };
                          })
                        }
                        inputMode="decimal"
                        className="font-[family-name:var(--font-mono)]"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-5 grid gap-3 border-t border-[color:var(--rule)] pt-4 sm:grid-cols-2">
              <AppField
                label="Packaging emissions (kg CO₂e)"
                value={form.totalPackagingEmissions}
                onChange={(e) =>
                  setForm((f) => ({ ...f, totalPackagingEmissions: e.target.value }))
                }
                inputMode="decimal"
                className="font-[family-name:var(--font-mono)]"
              />
              <AppField
                label="Transport distance (km)"
                value={form.transportDistance}
                onChange={(e) =>
                  setForm((f) => ({ ...f, transportDistance: e.target.value }))
                }
                inputMode="decimal"
                className="font-[family-name:var(--font-mono)]"
              />
              <AppSelectNative
                label="Transport mode"
                value={form.transportMode}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    transportMode: e.target.value as ProductTransportMode | "",
                  }))
                }
              >
                <option value="">None</option>
                {PRODUCT_TRANSPORT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {MODE_LABELS[m]}
                  </option>
                ))}
              </AppSelectNative>
              <AppField
                label="Transport factor (kgCO₂e / km / unit)"
                value={form.transportEmissionsFactor}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    transportEmissionsFactor: e.target.value,
                  }))
                }
                inputMode="decimal"
                className="font-[family-name:var(--font-mono)]"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-[color:var(--rule)] pt-4">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={saveProduct}>
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </PageFrame>
  );
}
