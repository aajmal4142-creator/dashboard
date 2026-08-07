"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import {
  EmptyState,
  PageFrame,
  PageSkeleton,
  StatusLine,
} from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { AppField, AppSelectNative } from "@/components/ui/AppField";
import {
  FACILITY_TYPE_LABELS,
  FACILITY_TYPES,
  METER_UTILITIES,
  METER_UTILITY_LABELS,
  type FacilityDto,
  type FacilityTreeNode,
  type FacilityType,
  type MeterDto,
  type MeterUtility,
} from "@/lib/facilities";
import { buildOpenSupplyHubUrl } from "@/lib/openSupplyHub";
import { cn } from "@/lib/utils";

type IndexPayload = {
  facilities: FacilityDto[];
  meters: MeterDto[];
  forest: FacilityTreeNode[];
  canWrite?: boolean;
  error?: string;
};

type FacilityForm = {
  name: string;
  code: string;
  facilityType: FacilityType;
  country: string;
  region: string;
  address: string;
  active: boolean;
  parentFacilityId: string;
  notes: string;
  openSupplyHubId: string;
};

type MeterForm = {
  name: string;
  utility: MeterUtility;
  unit: string;
  externalId: string;
  active: boolean;
  notes: string;
};

function emptyFacilityForm(): FacilityForm {
  return {
    name: "",
    code: "",
    facilityType: "office",
    country: "",
    region: "",
    address: "",
    active: true,
    parentFacilityId: "",
    notes: "",
    openSupplyHubId: "",
  };
}

function emptyMeterForm(): MeterForm {
  return {
    name: "",
    utility: "electricity",
    unit: "kWh",
    externalId: "",
    active: true,
    notes: "",
  };
}

function Mono({ children }: { children: string }) {
  return (
    <span className="font-[family-name:var(--font-mono)] tabular-nums">{children}</span>
  );
}

function TreeRows({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: FacilityTreeNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="space-y-0">
      {nodes.map((n) => (
        <li key={n.id}>
          <button
            type="button"
            onClick={() => onSelect(n.id)}
            className={cn(
              "flex w-full items-baseline gap-2 border-b border-[color:var(--rule)] px-2 py-2 text-left text-sm transition-colors",
              selectedId === n.id
                ? "bg-[color:var(--surface-2)] text-[color:var(--ink)]"
                : "text-[color:var(--ink)] hover:bg-[color:var(--surface-1)]",
            )}
            style={{ paddingLeft: `${8 + n.depth * 16}px` }}
          >
            <span className="min-w-0 flex-1 truncate font-medium">{n.name}</span>
            <span className="shrink-0 text-[11px] text-[color:var(--ink-muted)]">
              <Mono>{n.code}</Mono>
            </span>
            <span className="shrink-0 text-[11px] text-[color:var(--ink-muted)]">
              <Mono>{String(n.meterCount)}</Mono> m
            </span>
            {!n.active ? (
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-[color:var(--amber)]">
                inactive
              </span>
            ) : null}
          </button>
          {n.children.length > 0 ? (
            <TreeRows nodes={n.children} selectedId={selectedId} onSelect={onSelect} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function FacilitiesClient({
  orgName,
  canWrite,
  canDelete,
  eyebrow,
  title,
  help,
}: {
  orgName: string;
  canWrite: boolean;
  canDelete: boolean;
  eyebrow: string;
  title: string;
  help: string;
}) {
  const [index, setIndex] = useState<IndexPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [facilityOpen, setFacilityOpen] = useState(false);
  const [editingFacilityId, setEditingFacilityId] = useState<string | null>(null);
  const [facilityForm, setFacilityForm] = useState<FacilityForm>(emptyFacilityForm);
  const [facilityError, setFacilityError] = useState<string | null>(null);

  const [meterOpen, setMeterOpen] = useState(false);
  const [editingMeterId, setEditingMeterId] = useState<string | null>(null);
  const [meterForm, setMeterForm] = useState<MeterForm>(emptyMeterForm);
  const [meterError, setMeterError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/app/facilities");
        const json = (await res.json()) as IndexPayload;
        if (!res.ok) {
          setError(json.error ?? "Could not load facilities");
          return;
        }
        setIndex(json);
        if (selectedId && !json.facilities.some((f) => f.id === selectedId)) {
          setSelectedId(null);
        }
      } catch {
        setError("Network error loading facilities. Retry.");
      }
    });
  }, [selectedId]);

  useEffect(() => {
    load();
    // intentional: load once on mount; selectedId cleanup handled inside load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = index?.facilities.find((f) => f.id === selectedId) ?? null;
  const selectedMeters = index?.meters.filter((m) => m.facilityId === selectedId) ?? [];
  const parentOptions = index?.facilities.filter((f) => f.id !== editingFacilityId) ?? [];

  function openCreateFacility() {
    setEditingFacilityId(null);
    setFacilityForm({
      ...emptyFacilityForm(),
      parentFacilityId: selectedId ?? "",
    });
    setFacilityError(null);
    setFacilityOpen(true);
  }

  function openEditFacility(f: FacilityDto) {
    setEditingFacilityId(f.id);
    setFacilityForm({
      name: f.name,
      code: f.code,
      facilityType: f.facilityType,
      country: f.country ?? "",
      region: f.region ?? "",
      address: f.address ?? "",
      active: f.active,
      parentFacilityId: f.parentId ?? "",
      notes: f.notes ?? "",
      openSupplyHubId: f.openSupplyHubId ?? "",
    });
    setFacilityError(null);
    setFacilityOpen(true);
  }

  function saveFacility() {
    if (!canWrite) return;
    startTransition(async () => {
      setFacilityError(null);
      setStatusMsg(null);
      const body = {
        name: facilityForm.name,
        code: facilityForm.code,
        facilityType: facilityForm.facilityType,
        country: facilityForm.country || null,
        region: facilityForm.region || null,
        address: facilityForm.address || null,
        active: facilityForm.active,
        parentFacilityId: facilityForm.parentFacilityId || null,
        notes: facilityForm.notes || null,
        openSupplyHubId: facilityForm.openSupplyHubId || null,
      };
      const url = editingFacilityId
        ? `/api/app/facilities/${editingFacilityId}`
        : "/api/app/facilities";
      const method = editingFacilityId ? "PUT" : "POST";
      try {
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as { error?: string; facility?: FacilityDto };
        if (!res.ok) {
          setFacilityError(json.error ?? "Could not save facility");
          return;
        }
        setFacilityOpen(false);
        setStatusMsg(editingFacilityId ? "Facility updated." : "Facility created.");
        if (json.facility) setSelectedId(json.facility.id);
        load();
      } catch {
        setFacilityError("Network error saving facility. Retry.");
      }
    });
  }

  function deleteFacility(id: string) {
    if (!canDelete) return;
    if (
      !window.confirm(
        "Delete this facility and its meters? Child facilities must be reassigned first.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      setStatusMsg(null);
      try {
        const res = await fetch(`/api/app/facilities/${id}`, { method: "DELETE" });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(json.error ?? "Could not delete facility");
          return;
        }
        if (selectedId === id) setSelectedId(null);
        setStatusMsg("Facility deleted.");
        load();
      } catch {
        setError("Network error deleting facility. Retry.");
      }
    });
  }

  function openCreateMeter() {
    if (!selectedId) return;
    setEditingMeterId(null);
    setMeterForm(emptyMeterForm());
    setMeterError(null);
    setMeterOpen(true);
  }

  function openEditMeter(m: MeterDto) {
    setEditingMeterId(m.id);
    setMeterForm({
      name: m.name,
      utility: m.utility,
      unit: m.unit,
      externalId: m.externalId ?? "",
      active: m.active,
      notes: m.notes ?? "",
    });
    setMeterError(null);
    setMeterOpen(true);
  }

  function saveMeter() {
    if (!canWrite || !selectedId) return;
    startTransition(async () => {
      setMeterError(null);
      setStatusMsg(null);
      const body = {
        name: meterForm.name,
        utility: meterForm.utility,
        unit: meterForm.unit,
        externalId: meterForm.externalId || null,
        active: meterForm.active,
        notes: meterForm.notes || null,
        facilityId: selectedId,
      };
      const url = editingMeterId
        ? `/api/app/facilities/meters/${editingMeterId}`
        : `/api/app/facilities/${selectedId}/meters`;
      const method = editingMeterId ? "PUT" : "POST";
      try {
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          setMeterError(json.error ?? "Could not save meter");
          return;
        }
        setMeterOpen(false);
        setStatusMsg(editingMeterId ? "Meter updated." : "Meter created.");
        load();
      } catch {
        setMeterError("Network error saving meter. Retry.");
      }
    });
  }

  function deleteMeter(id: string) {
    if (!canDelete) return;
    if (!window.confirm("Delete this meter?")) return;
    startTransition(async () => {
      setStatusMsg(null);
      try {
        const res = await fetch(`/api/app/facilities/meters/${id}`, {
          method: "DELETE",
        });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(json.error ?? "Could not delete meter");
          return;
        }
        setStatusMsg("Meter deleted.");
        load();
      } catch {
        setError("Network error deleting meter. Retry.");
      }
    });
  }

  return (
    <PageFrame
      eyebrow={eyebrow}
      title={title}
      help={help}
      actions={
        canWrite ? (
          <Button type="button" onClick={openCreateFacility} disabled={pending}>
            <Plus className="mr-1 size-4" aria-hidden />
            Add facility
          </Button>
        ) : null
      }
    >
      <p className="mb-4 text-[12px] text-[color:var(--ink-muted)]">
        Organisation <span className="text-[color:var(--ink)]">{orgName}</span>
        {" · "}
        Operational sites only — legal consolidation stays under{" "}
        <a href="/settings/org-hierarchy" className="editorial-link text-accent">
          Org hierarchy
        </a>
        .
      </p>

      {error ? <StatusLine tone="error">{error}</StatusLine> : null}
      {statusMsg ? <StatusLine tone="ok">{statusMsg}</StatusLine> : null}
      {!canWrite ? (
        <StatusLine>View only — ask a contributor or admin to edit sites.</StatusLine>
      ) : null}

      {pending && !index ? <PageSkeleton rows={6} /> : null}

      {!pending && index && index.facilities.length === 0 ? (
        <EmptyState
          title="No facilities yet"
          body="Add offices, plants, and warehouses as first-class sites. Link meters and IoT devices when ready."
          action={
            canWrite ? (
              <Button type="button" onClick={openCreateFacility}>
                Add facility
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {index && index.facilities.length > 0 ? (
        <div className="mt-4 grid gap-6 lg:grid-cols-12">
          <section className="rounded-[6px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] lg:col-span-5">
            <div className="flex items-center justify-between border-b border-[color:var(--rule)] px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
                Hierarchy
              </p>
              <span className="text-[12px] text-[color:var(--ink-muted)]">
                <Mono>{String(index.facilities.length)}</Mono> sites
              </span>
            </div>
            <TreeRows
              nodes={index.forest}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </section>

          <section className="lg:col-span-7">
            {!selected ? (
              <EmptyState
                title="Select a facility"
                body="Choose a site in the hierarchy to view details and meters."
              />
            ) : (
              <div className="space-y-6">
                <div className="rounded-[6px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--ink)]">
                        {selected.name}
                      </h2>
                      <p className="mt-1 text-sm text-[color:var(--ink-muted)]">
                        <Mono>{selected.code}</Mono>
                        {" · "}
                        {FACILITY_TYPE_LABELS[selected.facilityType]}
                        {selected.country ? ` · ${selected.country}` : ""}
                        {!selected.active ? " · inactive" : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {canWrite ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEditFacility(selected)}
                        >
                          <Pencil className="mr-1 size-3.5" aria-hidden />
                          Edit
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => deleteFacility(selected.id)}
                        >
                          <Trash2 className="mr-1 size-3.5" aria-hidden />
                          Delete
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {selected.region || selected.address ? (
                    <p className="mt-3 text-sm text-[color:var(--ink-muted)]">
                      {[selected.region, selected.address].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                  {selected.notes ? (
                    <p className="mt-2 text-sm text-[color:var(--ink)]">
                      {selected.notes}
                    </p>
                  ) : null}
                  <p className="mt-3 text-[12px] text-[color:var(--ink-muted)]">
                    Open Supply Hub{" "}
                    {selected.openSupplyHubId ? (
                      buildOpenSupplyHubUrl(selected.openSupplyHubId) ? (
                        <a
                          href={
                            buildOpenSupplyHubUrl(selected.openSupplyHubId) ?? undefined
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="editorial-link text-accent"
                        >
                          {selected.openSupplyHubId}
                        </a>
                      ) : (
                        <span className="font-data text-[color:var(--ink)]">
                          {selected.openSupplyHubId}
                        </span>
                      )
                    ) : (
                      <span className="text-[color:var(--ink-muted)]">Not linked</span>
                    )}
                  </p>
                </div>

                <div className="rounded-[6px] border border-[color:var(--rule)] bg-[color:var(--surface-1)]">
                  <div className="flex items-center justify-between border-b border-[color:var(--rule)] px-4 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
                      Meters
                    </p>
                    {canWrite ? (
                      <Button type="button" size="sm" onClick={openCreateMeter}>
                        <Plus className="mr-1 size-3.5" aria-hidden />
                        Add meter
                      </Button>
                    ) : null}
                  </div>
                  {selectedMeters.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-[color:var(--ink-muted)]">
                      No meters on this facility.
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[color:var(--rule)] text-left text-[10px] uppercase tracking-wide text-[color:var(--ink-muted)]">
                          <th className="px-4 py-2 font-semibold">Name</th>
                          <th className="px-2 py-2 font-semibold">Utility</th>
                          <th className="px-2 py-2 font-semibold">Unit</th>
                          <th className="px-2 py-2 font-semibold">External id</th>
                          <th className="px-4 py-2 font-semibold" />
                        </tr>
                      </thead>
                      <tbody>
                        {selectedMeters.map((m) => (
                          <tr
                            key={m.id}
                            className="border-b border-[color:var(--rule)] last:border-0"
                          >
                            <td className="px-4 py-2 text-[color:var(--ink)]">
                              {m.name}
                              {!m.active ? (
                                <span className="ml-2 text-[10px] uppercase text-[color:var(--amber)]">
                                  inactive
                                </span>
                              ) : null}
                            </td>
                            <td className="px-2 py-2 text-[color:var(--ink-muted)]">
                              {METER_UTILITY_LABELS[m.utility]}
                            </td>
                            <td className="px-2 py-2">
                              <Mono>{m.unit}</Mono>
                            </td>
                            <td className="px-2 py-2 text-[color:var(--ink-muted)]">
                              {m.externalId ? <Mono>{m.externalId}</Mono> : "—"}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <div className="flex justify-end gap-1">
                                {canWrite ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEditMeter(m)}
                                    aria-label={`Edit ${m.name}`}
                                  >
                                    <Pencil className="size-3.5" />
                                  </Button>
                                ) : null}
                                {canDelete ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteMeter(m.id)}
                                    aria-label={`Delete ${m.name}`}
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {facilityOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[color:var(--ink)]/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal
            aria-labelledby="facility-dialog-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[6px] border border-[color:var(--rule)] bg-[color:var(--canvas)] p-5 shadow-lg"
          >
            <h2
              id="facility-dialog-title"
              className="font-[family-name:var(--font-display)] text-xl text-[color:var(--ink)]"
            >
              {editingFacilityId ? "Edit facility" : "Add facility"}
            </h2>
            <div className="mt-4 grid gap-3">
              <AppField
                label="Name"
                value={facilityForm.name}
                onChange={(e) => setFacilityForm((f) => ({ ...f, name: e.target.value }))}
              />
              <AppField
                label="Code"
                value={facilityForm.code}
                onChange={(e) => setFacilityForm((f) => ({ ...f, code: e.target.value }))}
              />
              <AppSelectNative
                label="Type"
                value={facilityForm.facilityType}
                onChange={(e) =>
                  setFacilityForm((f) => ({
                    ...f,
                    facilityType: e.target.value as FacilityType,
                  }))
                }
              >
                {FACILITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {FACILITY_TYPE_LABELS[t]}
                  </option>
                ))}
              </AppSelectNative>
              <AppSelectNative
                label="Parent facility"
                value={facilityForm.parentFacilityId}
                onChange={(e) =>
                  setFacilityForm((f) => ({
                    ...f,
                    parentFacilityId: e.target.value,
                  }))
                }
              >
                <option value="">None (root)</option>
                {parentOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.code})
                  </option>
                ))}
              </AppSelectNative>
              <div className="grid grid-cols-2 gap-3">
                <AppField
                  label="Country (ISO)"
                  value={facilityForm.country}
                  maxLength={2}
                  onChange={(e) =>
                    setFacilityForm((f) => ({
                      ...f,
                      country: e.target.value.toUpperCase(),
                    }))
                  }
                />
                <AppField
                  label="Region"
                  value={facilityForm.region}
                  onChange={(e) =>
                    setFacilityForm((f) => ({ ...f, region: e.target.value }))
                  }
                />
              </div>
              <AppField
                label="Address"
                value={facilityForm.address}
                onChange={(e) =>
                  setFacilityForm((f) => ({ ...f, address: e.target.value }))
                }
              />
              <AppField
                label="Open Supply Hub OS ID"
                placeholder="e.g. US2021250D1DTN7"
                value={facilityForm.openSupplyHubId}
                onChange={(e) =>
                  setFacilityForm((f) => ({ ...f, openSupplyHubId: e.target.value }))
                }
              />
              <AppField
                label="Notes"
                value={facilityForm.notes}
                onChange={(e) =>
                  setFacilityForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
              <label className="flex items-center gap-2 text-sm text-[color:var(--ink)]">
                <input
                  type="checkbox"
                  checked={facilityForm.active}
                  onChange={(e) =>
                    setFacilityForm((f) => ({ ...f, active: e.target.checked }))
                  }
                />
                Active
              </label>
            </div>
            {facilityError ? <StatusLine tone="error">{facilityError}</StatusLine> : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFacilityOpen(false)}
              >
                Cancel
              </Button>
              <Button type="button" onClick={saveFacility} disabled={pending}>
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {meterOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[color:var(--ink)]/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal
            aria-labelledby="meter-dialog-title"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[6px] border border-[color:var(--rule)] bg-[color:var(--canvas)] p-5 shadow-lg"
          >
            <h2
              id="meter-dialog-title"
              className="font-[family-name:var(--font-display)] text-xl text-[color:var(--ink)]"
            >
              {editingMeterId ? "Edit meter" : "Add meter"}
            </h2>
            <div className="mt-4 grid gap-3">
              <AppField
                label="Name"
                value={meterForm.name}
                onChange={(e) => setMeterForm((f) => ({ ...f, name: e.target.value }))}
              />
              <AppSelectNative
                label="Utility"
                value={meterForm.utility}
                onChange={(e) =>
                  setMeterForm((f) => ({
                    ...f,
                    utility: e.target.value as MeterUtility,
                  }))
                }
              >
                {METER_UTILITIES.map((u) => (
                  <option key={u} value={u}>
                    {METER_UTILITY_LABELS[u]}
                  </option>
                ))}
              </AppSelectNative>
              <AppField
                label="Unit"
                value={meterForm.unit}
                onChange={(e) => setMeterForm((f) => ({ ...f, unit: e.target.value }))}
              />
              <AppField
                label="External id"
                value={meterForm.externalId}
                onChange={(e) =>
                  setMeterForm((f) => ({ ...f, externalId: e.target.value }))
                }
              />
              <AppField
                label="Notes"
                value={meterForm.notes}
                onChange={(e) => setMeterForm((f) => ({ ...f, notes: e.target.value }))}
              />
              <label className="flex items-center gap-2 text-sm text-[color:var(--ink)]">
                <input
                  type="checkbox"
                  checked={meterForm.active}
                  onChange={(e) =>
                    setMeterForm((f) => ({ ...f, active: e.target.checked }))
                  }
                />
                Active
              </label>
            </div>
            {meterError ? <StatusLine tone="error">{meterError}</StatusLine> : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setMeterOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={saveMeter} disabled={pending}>
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </PageFrame>
  );
}
