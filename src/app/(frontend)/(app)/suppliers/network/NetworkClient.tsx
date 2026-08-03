"use client";

import { useCallback, useEffect, useState, useTransition, type ReactNode } from "react";

import { EmptyState, PageCard, StatusLine } from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NetworkInviteStatus, SnapshotQuality } from "@/lib/suppliers/network";

type NetworkInvite = {
  id: string;
  inviteEmail: string;
  status: NetworkInviteStatus;
  buyerOrganisationId: string;
  buyerOrganisationName: string | null;
  supplierOrganisationId: string | null;
  supplierOrganisationName: string | null;
  supplierDisplayName: string | null;
  message: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  declinedAt: string | null;
  revokedAt: string | null;
  createdAt: string | null;
  expired: boolean;
};

type SharedSnapshot = {
  id: string;
  supplierOrganisationId: string;
  supplierOrganisationName: string | null;
  inviteId: string;
  periodLabel: string;
  periodStart: string | null;
  periodEnd: string | null;
  scope1Tco2e: number | null;
  scope2Tco2e: number | null;
  scope3Tco2e: number | null;
  quality: SnapshotQuality;
  consentedAt: string;
  note: string | null;
};

type Labels = {
  disclaimer: string;
  inviteTitle: string;
  inviteHelp: string;
  fieldEmail: string;
  fieldDisplayName: string;
  fieldMessage: string;
  sendInvite: string;
  sending: string;
  invitesTitle: string;
  sharesTitle: string;
  sharesEmptyTitle: string;
  sharesEmptyHelp: string;
  invitesEmptyTitle: string;
  invitesEmptyHelp: string;
  incomingTitle: string;
  incomingHelp: string;
  incomingEmptyTitle: string;
  incomingEmptyHelp: string;
  accept: string;
  decline: string;
  cancel: string;
  revoke: string;
  accepting: string;
  fieldPeriod: string;
  fieldScope1: string;
  fieldScope2: string;
  fieldScope3: string;
  fieldNote: string;
  scopeHint: string;
  refresh: string;
  retry: string;
  viewOnly: string;
  errorLoad: string;
  statusPending: string;
  statusAccepted: string;
  statusDeclined: string;
  statusRevoked: string;
  qualityMeasured: string;
  qualityPartial: string;
  qualityMissing: string;
  colSupplier: string;
  colPeriod: string;
  colScope1: string;
  colScope2: string;
  colScope3: string;
  colQuality: string;
  colStatus: string;
  colEmail: string;
  colActions: string;
  inviteOk: string;
  acceptOk: string;
  declineOk: string;
  revokeOk: string;
  actionFailed: string;
  fromBuyer: string;
};

function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("font-[family-name:var(--font-mono)] tabular-nums", className)}>
      {children}
    </span>
  );
}

function formatNum(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

function statusLabel(status: NetworkInviteStatus, labels: Labels): string {
  switch (status) {
    case "pending":
      return labels.statusPending;
    case "accepted":
      return labels.statusAccepted;
    case "declined":
      return labels.statusDeclined;
    case "revoked":
      return labels.statusRevoked;
    default:
      return status;
  }
}

function qualityLabel(quality: SnapshotQuality, labels: Labels): string {
  switch (quality) {
    case "measured":
      return labels.qualityMeasured;
    case "partial":
      return labels.qualityPartial;
    case "missing":
      return labels.qualityMissing;
    default:
      return quality;
  }
}

function statusClass(status: NetworkInviteStatus): string {
  if (status === "accepted") return "text-[color:var(--signal)]";
  if (status === "pending") return "text-[color:var(--amber)]";
  if (status === "declined" || status === "revoked") {
    return "text-[color:var(--ink-muted)]";
  }
  return "text-[color:var(--ink-muted)]";
}

export function NetworkClient({
  canWrite,
  labels,
  orgName,
  userEmail,
}: {
  canWrite: boolean;
  labels: Labels;
  orgName: string;
  userEmail: string;
}) {
  const [invites, setInvites] = useState<NetworkInvite[]>([]);
  const [incoming, setIncoming] = useState<NetworkInvite[]>([]);
  const [shares, setShares] = useState<SharedSnapshot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [inviteEmail, setInviteEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [acceptId, setAcceptId] = useState<string | null>(null);
  const [periodLabel, setPeriodLabel] = useState("");
  const [scope1, setScope1] = useState("");
  const [scope2, setScope2] = useState("");
  const [scope3, setScope3] = useState("");
  const [shareNote, setShareNote] = useState("");
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const load = useCallback(() => {
    startTransition(async () => {
      setError(null);
      try {
        const [invRes, inRes, shRes] = await Promise.all([
          fetch("/api/app/suppliers/network/invites"),
          fetch("/api/app/suppliers/network/invites/incoming"),
          fetch("/api/app/suppliers/network/shares"),
        ]);
        const invJson = (await invRes.json()) as {
          invites?: NetworkInvite[];
          error?: string;
        };
        const inJson = (await inRes.json()) as {
          invites?: NetworkInvite[];
          error?: string;
        };
        const shJson = (await shRes.json()) as {
          shares?: SharedSnapshot[];
          error?: string;
        };
        if (!invRes.ok) {
          setError(invJson.error ?? labels.errorLoad);
          return;
        }
        if (!inRes.ok) {
          setError(inJson.error ?? labels.errorLoad);
          return;
        }
        if (!shRes.ok) {
          setError(shJson.error ?? labels.errorLoad);
          return;
        }
        setInvites(invJson.invites ?? []);
        setIncoming(inJson.invites ?? []);
        setShares(shJson.shares ?? []);
      } catch {
        setError(labels.errorLoad);
      }
    });
  }, [labels.errorLoad]);

  useEffect(() => {
    load();
  }, [load]);

  function sendInvite() {
    if (!canWrite) return;
    setFormError(null);
    setFlash(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/app/suppliers/network/invites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inviteEmail,
            supplierDisplayName: displayName || null,
            message: message || null,
          }),
        });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          setFormError(json.error ?? labels.actionFailed);
          return;
        }
        setInviteEmail("");
        setDisplayName("");
        setMessage("");
        setFlash(labels.inviteOk);
        load();
      } catch {
        setFormError(labels.actionFailed);
      }
    });
  }

  function revokeInvite(id: string) {
    if (!canWrite) return;
    setFlash(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/app/suppliers/network/invites/${id}/revoke`, {
          method: "POST",
        });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(json.error ?? labels.actionFailed);
          return;
        }
        setFlash(labels.revokeOk);
        load();
      } catch {
        setError(labels.actionFailed);
      }
    });
  }

  function declineInvite(id: string) {
    if (!canWrite) return;
    setFlash(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/app/suppliers/network/invites/${id}/decline`, {
          method: "POST",
        });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(json.error ?? labels.actionFailed);
          return;
        }
        setFlash(labels.declineOk);
        setAcceptId(null);
        load();
      } catch {
        setError(labels.actionFailed);
      }
    });
  }

  function acceptInvite(id: string) {
    if (!canWrite) return;
    setAcceptError(null);
    setFlash(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/app/suppliers/network/invites/${id}/accept`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            periodLabel,
            scope1Tco2e: scope1,
            scope2Tco2e: scope2,
            scope3Tco2e: scope3,
            note: shareNote || null,
          }),
        });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          setAcceptError(json.error ?? labels.actionFailed);
          return;
        }
        setAcceptId(null);
        setPeriodLabel("");
        setScope1("");
        setScope2("");
        setScope3("");
        setShareNote("");
        setFlash(labels.acceptOk);
        load();
      } catch {
        setAcceptError(labels.actionFailed);
      }
    });
  }

  const inputClass =
    "w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-1)] px-3 py-2 text-sm text-[color:var(--ink)] outline-none focus:border-[color:var(--rule-strong)]";

  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-[color:var(--ink-muted)]">
        {labels.disclaimer}
      </p>

      {!canWrite ? <StatusLine tone="neutral">{labels.viewOnly}</StatusLine> : null}
      {error ? <StatusLine tone="error">{error}</StatusLine> : null}
      {flash ? <StatusLine tone="ok">{flash}</StatusLine> : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={load}
          disabled={pending}
        >
          {labels.refresh}
        </Button>
        {error ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={load}
            disabled={pending}
          >
            {labels.retry}
          </Button>
        ) : null}
      </div>

      {/* Supplier: incoming invites */}
      <section className="space-y-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--ink)]">
            {labels.incomingTitle}
          </h2>
          <p className="mt-1 text-sm text-[color:var(--ink-muted)]">
            {labels.incomingHelp}{" "}
            <Mono className="text-[color:var(--ink)]">{userEmail}</Mono>
            {" · "}
            {orgName}
          </p>
        </div>

        {incoming.length === 0 ? (
          <EmptyState title={labels.incomingEmptyTitle} body={labels.incomingEmptyHelp} />
        ) : (
          <div className="space-y-3">
            {incoming.map((inv) => (
              <PageCard key={inv.id} className="space-y-3 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="text-sm text-[color:var(--ink)]">
                      {labels.fromBuyer}{" "}
                      <span className="font-medium">
                        {inv.buyerOrganisationName ?? inv.buyerOrganisationId}
                      </span>
                    </p>
                    {inv.message ? (
                      <p className="mt-1 text-sm text-[color:var(--ink-muted)]">
                        {inv.message}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      "text-xs uppercase tracking-wide",
                      statusClass(inv.status),
                    )}
                  >
                    {statusLabel(inv.status, labels)}
                  </span>
                </div>

                {acceptId === inv.id ? (
                  <div className="space-y-3 border-t border-[color:var(--rule)] pt-3">
                    <p className="text-xs text-[color:var(--ink-muted)]">
                      {labels.scopeHint}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-xs text-[color:var(--ink-muted)]">
                        {labels.fieldPeriod}
                        <input
                          className={cn(inputClass, "mt-1")}
                          value={periodLabel}
                          onChange={(e) => setPeriodLabel(e.target.value)}
                          placeholder="FY2024"
                        />
                      </label>
                      <label className="block text-xs text-[color:var(--ink-muted)]">
                        {labels.fieldNote}
                        <input
                          className={cn(inputClass, "mt-1")}
                          value={shareNote}
                          onChange={(e) => setShareNote(e.target.value)}
                        />
                      </label>
                      <label className="block text-xs text-[color:var(--ink-muted)]">
                        {labels.fieldScope1}
                        <input
                          className={cn(
                            inputClass,
                            "mt-1 font-[family-name:var(--font-mono)]",
                          )}
                          value={scope1}
                          onChange={(e) => setScope1(e.target.value)}
                          inputMode="decimal"
                          placeholder="—"
                        />
                      </label>
                      <label className="block text-xs text-[color:var(--ink-muted)]">
                        {labels.fieldScope2}
                        <input
                          className={cn(
                            inputClass,
                            "mt-1 font-[family-name:var(--font-mono)]",
                          )}
                          value={scope2}
                          onChange={(e) => setScope2(e.target.value)}
                          inputMode="decimal"
                          placeholder="—"
                        />
                      </label>
                      <label className="block text-xs text-[color:var(--ink-muted)] sm:col-span-2">
                        {labels.fieldScope3}
                        <input
                          className={cn(
                            inputClass,
                            "mt-1 font-[family-name:var(--font-mono)]",
                          )}
                          value={scope3}
                          onChange={(e) => setScope3(e.target.value)}
                          inputMode="decimal"
                          placeholder="—"
                        />
                      </label>
                    </div>
                    {acceptError ? (
                      <StatusLine tone="error">{acceptError}</StatusLine>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={pending || !canWrite}
                        onClick={() => acceptInvite(inv.id)}
                      >
                        {pending ? labels.accepting : labels.accept}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => {
                          setAcceptId(null);
                          setAcceptError(null);
                        }}
                      >
                        {labels.cancel}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={!canWrite || pending}
                      onClick={() => {
                        setAcceptId(inv.id);
                        setAcceptError(null);
                      }}
                    >
                      {labels.accept}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!canWrite || pending}
                      onClick={() => declineInvite(inv.id)}
                    >
                      {labels.decline}
                    </Button>
                  </div>
                )}
              </PageCard>
            ))}
          </div>
        )}
      </section>

      {/* Buyer: send invite */}
      {canWrite ? (
        <section className="space-y-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--ink)]">
              {labels.inviteTitle}
            </h2>
            <p className="mt-1 text-sm text-[color:var(--ink-muted)]">
              {labels.inviteHelp}
            </p>
          </div>
          <PageCard className="space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-[color:var(--ink-muted)]">
                {labels.fieldEmail}
                <input
                  className={cn(inputClass, "mt-1")}
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </label>
              <label className="block text-xs text-[color:var(--ink-muted)]">
                {labels.fieldDisplayName}
                <input
                  className={cn(inputClass, "mt-1")}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </label>
              <label className="block text-xs text-[color:var(--ink-muted)] sm:col-span-2">
                {labels.fieldMessage}
                <textarea
                  className={cn(inputClass, "mt-1 min-h-[72px]")}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </label>
            </div>
            {formError ? <StatusLine tone="error">{formError}</StatusLine> : null}
            <Button
              type="button"
              size="sm"
              disabled={pending || !inviteEmail.trim()}
              onClick={sendInvite}
            >
              {pending ? labels.sending : labels.sendInvite}
            </Button>
          </PageCard>
        </section>
      ) : null}

      {/* Buyer: invites sent */}
      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--ink)]">
          {labels.invitesTitle}
        </h2>
        {invites.length === 0 ? (
          <EmptyState title={labels.invitesEmptyTitle} body={labels.invitesEmptyHelp} />
        ) : (
          <div className="overflow-x-auto border-t border-[color:var(--rule)]">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-[color:var(--rule)] text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">
                  <th className="py-2 pr-3 font-medium">{labels.colEmail}</th>
                  <th className="py-2 pr-3 font-medium">{labels.colSupplier}</th>
                  <th className="py-2 pr-3 font-medium">{labels.colStatus}</th>
                  <th className="py-2 pr-3 font-medium">{labels.colActions}</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => (
                  <tr key={inv.id} className="border-b border-[color:var(--rule)]">
                    <td className="py-2 pr-3 text-[color:var(--ink)]">
                      {inv.inviteEmail}
                    </td>
                    <td className="py-2 pr-3 text-[color:var(--ink-muted)]">
                      {inv.supplierDisplayName || inv.supplierOrganisationName || "—"}
                    </td>
                    <td
                      className={cn(
                        "py-2 pr-3 text-xs uppercase",
                        statusClass(inv.status),
                      )}
                    >
                      {statusLabel(inv.status, labels)}
                      {inv.expired && inv.status === "pending" ? " · expired" : ""}
                    </td>
                    <td className="py-2 pr-3">
                      {inv.status === "pending" || inv.status === "accepted" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!canWrite || pending}
                          onClick={() => revokeInvite(inv.id)}
                        >
                          {labels.revoke}
                        </Button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Buyer: shared totals */}
      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--ink)]">
          {labels.sharesTitle}
        </h2>
        {shares.length === 0 ? (
          <EmptyState title={labels.sharesEmptyTitle} body={labels.sharesEmptyHelp} />
        ) : (
          <div className="overflow-x-auto border-t border-[color:var(--rule)]">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-[color:var(--rule)] text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">
                  <th className="py-2 pr-3 font-medium">{labels.colSupplier}</th>
                  <th className="py-2 pr-3 font-medium">{labels.colPeriod}</th>
                  <th className="py-2 pr-3 font-medium">{labels.colScope1}</th>
                  <th className="py-2 pr-3 font-medium">{labels.colScope2}</th>
                  <th className="py-2 pr-3 font-medium">{labels.colScope3}</th>
                  <th className="py-2 pr-3 font-medium">{labels.colQuality}</th>
                </tr>
              </thead>
              <tbody>
                {shares.map((s) => (
                  <tr key={s.id} className="border-b border-[color:var(--rule)]">
                    <td className="py-2 pr-3 text-[color:var(--ink)]">
                      {s.supplierOrganisationName ?? s.supplierOrganisationId}
                    </td>
                    <td className="py-2 pr-3 text-[color:var(--ink)]">{s.periodLabel}</td>
                    <td className="py-2 pr-3">
                      <Mono>{formatNum(s.scope1Tco2e)}</Mono>
                    </td>
                    <td className="py-2 pr-3">
                      <Mono>{formatNum(s.scope2Tco2e)}</Mono>
                    </td>
                    <td className="py-2 pr-3">
                      <Mono>{formatNum(s.scope3Tco2e)}</Mono>
                    </td>
                    <td className="py-2 pr-3 text-[color:var(--ink-muted)]">
                      {qualityLabel(s.quality, labels)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
