"use client";

import { useState } from "react";

import {
  EmptyState,
  PageCard,
  PageFrame,
  StatusLine,
} from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import type { ClientRiskRow } from "@/lib/consultant";
import type { SectorTemplate } from "@/lib/consultant/templates";

type Props = {
  initialClients: ClientRiskRow[];
  consultancy: {
    name: string;
    plan: string;
    clientCount: number;
    clientCap: number;
    brand: { primaryColor: string | null; domain: string | null };
  };
  templates: SectorTemplate[];
  canWrite?: boolean;
};

export function ConsultantCentre({
  initialClients,
  consultancy,
  templates,
  canWrite = true,
}: Props) {
  const [clients, setClients] = useState(initialClients);
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"neutral" | "error" | "ok">("neutral");
  const [primaryColor, setPrimaryColor] = useState(consultancy.brand.primaryColor ?? "");
  const [domain, setDomain] = useState(consultancy.brand.domain ?? "");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");

  function note(message: string, tone: "neutral" | "error" | "ok" = "neutral") {
    setStatusTone(tone);
    setStatus(message);
  }

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function refresh() {
    const res = await fetch("/api/app/consultant/clients");
    if (!res.ok) return;
    const data = (await res.json()) as { clients: ClientRiskRow[] };
    setClients(data.clients);
  }

  async function nudge() {
    if (!canWrite) {
      note("Viewers cannot send nudges.", "error");
      return;
    }
    note("Sending nudges…");
    const res = await fetch("/api/app/consultant/nudge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientIds: selected.length > 0 ? selected : clients.map((c) => c.id),
        message: "Please complete outstanding datapoints before your filing deadline.",
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      nudgesSent?: number;
      error?: string;
    };
    if (!res.ok) {
      const raw = data.error ?? "Nudge failed";
      note(
        raw === "Forbidden" ? "You do not have permission to nudge clients." : raw,
        "error",
      );
      return;
    }
    note(`Nudges sent: ${data.nudgesSent ?? 0}`, "ok");
  }

  async function inviteClient() {
    if (!canWrite) {
      note("Viewers cannot invite clients.", "error");
      return;
    }
    note("Inviting client…");
    const res = await fetch("/api/app/consultant/clients/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: inviteEmail,
        clientName: inviteName,
        country: "IN",
        framework: "BRSR",
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      slug?: string;
    };
    if (!res.ok) {
      const raw = data.error ?? "Invite failed";
      note(
        raw === "Forbidden" ? "You do not have permission to invite clients." : raw,
        "error",
      );
      return;
    }
    note(`Client invited (${data.slug ?? "ok"}) — pre-branded`, "ok");
    void refresh();
  }

  async function saveBrand() {
    if (!canWrite) {
      note("Viewers cannot change brand settings.", "error");
      return;
    }
    note("Saving brand…");
    const res = await fetch("/api/app/consultant/brand", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        primaryColor: primaryColor.trim() || undefined,
        domain,
      }),
    });
    if (!res.ok) {
      note("Brand save failed. Check the colour format and try again.", "error");
      return;
    }
    note(
      "Brand saved — refresh to see colours, or open Settings for full branding",
      "ok",
    );
  }

  return (
    <PageFrame
      eyebrow="Consultant command centre"
      title={consultancy.name}
      help={`Clients sorted by deadline risk. Plan ${consultancy.plan} · ${consultancy.clientCount}/${consultancy.clientCap} clients.`}
      actions={
        <div className="flex flex-wrap gap-2">
          {canWrite ? (
            <Button type="button" size="sm" onClick={() => void nudge()}>
              Nudge selected
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              window.location.assign("/api/app/consultant/export");
            }}
          >
            Export all
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void refresh()}
          >
            Refresh
          </Button>
        </div>
      }
      rail={
        <div className="space-y-4 text-[13px] text-ink-muted">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
              White-label
            </p>
            <p className="mt-2">
              Dashboard colours, font, and logo live under Account → Settings. Custom
              domain still saves here for consultancies on the consultant plan.
            </p>
            <a
              href="/dashboard/settings"
              className="mt-2 inline-block font-medium text-accent underline-offset-2 hover:underline"
            >
              Open Settings
            </a>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
              Billing
            </p>
            <p className="mt-2">
              Consultant €199/mo includes 10 clients; +€15/client after (Phase 12 Stripe).
            </p>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {status ? <StatusLine tone={statusTone}>{status}</StatusLine> : null}

        <div className="grid gap-4 md:grid-cols-2">
          <PageCard title="Brand">
            <label className="block text-[13px] text-ink-muted">
              Primary colour
              <input
                className="mt-1 w-full rounded-md border border-rule bg-surface-1 px-2 py-2 font-data text-ink"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="Leave blank for default"
                disabled={!canWrite}
              />
            </label>
            <label className="mt-3 block text-[13px] text-ink-muted">
              Custom domain
              <input
                className="mt-1 w-full rounded-md border border-rule bg-surface-1 px-2 py-2 text-ink"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="esg.yourfirm.com"
                disabled={!canWrite}
              />
            </label>
            {canWrite ? (
              <Button
                type="button"
                size="sm"
                className="mt-3"
                onClick={() => void saveBrand()}
              >
                Save brand
              </Button>
            ) : null}
          </PageCard>
          <PageCard title="Invite client">
            {canWrite ? (
              <>
                <label className="block text-[13px] text-ink-muted">
                  Client name
                  <input
                    className="mt-1 w-full rounded-md border border-rule bg-surface-1 px-2 py-2 text-ink"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                  />
                </label>
                <label className="mt-3 block text-[13px] text-ink-muted">
                  Owner email
                  <input
                    className="mt-1 w-full rounded-md border border-rule bg-surface-1 px-2 py-2 font-data text-ink"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </label>
                <Button
                  type="button"
                  size="sm"
                  className="mt-3"
                  onClick={() => void inviteClient()}
                >
                  Invite client
                </Button>
              </>
            ) : (
              <p className="text-[13px] text-ink-muted">
                View only — ask an admin to invite.
              </p>
            )}
          </PageCard>
        </div>

        <PageCard title="Sector templates">
          <ul>
            {templates.map((t) => (
              <li
                key={t.id}
                className="border-b border-rule py-2.5 transition-colors last:border-b-0 hover:bg-surface-2"
              >
                <span className="font-medium text-ink">{t.label}</span>
                <span className="mt-0.5 block font-data text-[11px] text-ink-muted">
                  {t.metricKeys.length} metrics
                </span>
              </li>
            ))}
          </ul>
        </PageCard>

        {clients.length === 0 ? (
          <EmptyState
            title="No linked clients"
            body="Invite a client above, or link a company by setting its parent organisation to this consultancy."
          />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  ["on_track", "On track", "text-signal"],
                  ["at_risk", "At risk", "text-amber"],
                  ["critical", "Critical", "text-rust"],
                ] as const
              ).map(([key, label, tone]) => {
                const n = clients.filter((c) => c.risk === key).length;
                return (
                  <div
                    key={key}
                    className="rounded-[6px] border border-rule bg-surface-1 px-4 py-3"
                  >
                    <p
                      className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${tone}`}
                    >
                      {label}
                    </p>
                    <p className={`mt-2 font-data text-[28px] font-bold ${tone}`}>{n}</p>
                    <p className="mt-1 text-[11px] text-ink-muted">clients</p>
                  </div>
                );
              })}
            </div>
            <PageCard title="Clients">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-[12px]">
                  <thead>
                    <tr className="border-b-2 border-rule-strong">
                      <th className="py-2.5 pr-2" />
                      <th className="py-2.5 pr-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                        Client
                      </th>
                      <th className="py-2.5 pr-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                        Days
                      </th>
                      <th className="py-2.5 pr-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                        Metrics
                      </th>
                      <th className="py-2.5 pr-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                        Score
                      </th>
                      <th className="py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                        Health
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((c) => (
                      <tr
                        key={c.id}
                        className="border-b border-rule transition-colors last:border-b-0 hover:bg-surface-2"
                      >
                        <td className="py-2.5 pr-2">
                          <input
                            type="checkbox"
                            checked={selected.includes(c.id)}
                            onChange={() => toggle(c.id)}
                            disabled={!canWrite}
                          />
                        </td>
                        <td className="py-2.5 pr-2">
                          <div className="font-medium text-ink">{c.name}</div>
                          <div className="font-data text-[11px] text-ink-muted">
                            {c.sector} · {c.country}
                          </div>
                        </td>
                        <td className="py-2.5 pr-2 font-data text-ink">
                          {c.daysToFiling === null ? "—" : c.daysToFiling}
                        </td>
                        <td className="py-2.5 pr-2 font-data text-ink-muted">
                          {c.datapointsCollected}/{c.datapointsRequired}
                        </td>
                        <td className="py-2.5 pr-2 font-data text-ink">
                          {c.overallScore === null ? "—" : c.overallScore}
                        </td>
                        <td
                          className={`py-2.5 font-data ${
                            c.risk === "critical"
                              ? "text-rust"
                              : c.risk === "at_risk"
                                ? "text-amber"
                                : c.risk === "on_track"
                                  ? "text-signal"
                                  : "text-ink-muted"
                          }`}
                        >
                          {c.risk === "on_track"
                            ? "On track"
                            : c.risk === "at_risk"
                              ? "At risk"
                              : c.risk === "critical"
                                ? "Critical"
                                : c.risk}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </PageCard>
          </>
        )}
      </div>
    </PageFrame>
  );
}
