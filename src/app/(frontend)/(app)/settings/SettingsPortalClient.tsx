"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { AppField } from "@/components/ui/AppField";
import { brandingCssVarsToInlineStyle, brandingToCssVars } from "@/lib/branding";
import {
  DEFAULT_PORTAL_HEADLINE,
  DEFAULT_PORTAL_WELCOME,
  type SupplierPortalConfigView,
} from "@/lib/portal";
import { cn } from "@/lib/utils";

type PortalBranding = {
  primaryColor: string | null;
  logoUrl: string | null;
};

type Props = {
  canEdit: boolean;
  orgName: string;
  initialPortal: SupplierPortalConfigView;
  initialBranding: PortalBranding;
};

export function SettingsPortalClient({
  canEdit,
  orgName,
  initialPortal,
  initialBranding,
}: Props) {
  const [portal, setPortal] = useState(initialPortal);
  const [prevInitialPortal, setPrevInitialPortal] = useState(initialPortal);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"ok" | "error" | "neutral">("neutral");
  const [pending, startTransition] = useTransition();

  if (initialPortal !== prevInitialPortal) {
    setPrevInitialPortal(initialPortal);
    setPortal(initialPortal);
  }

  function note(message: string, tone: "ok" | "error" | "neutral" = "neutral") {
    setStatus(message);
    setStatusTone(tone);
  }

  function save() {
    if (!canEdit) {
      note("Only owners and admins can change the supplier portal.", "error");
      return;
    }
    note("Saving…", "neutral");
    startTransition(async () => {
      try {
        const res = await fetch("/api/app/settings/portal", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enabled: portal.enabled,
            headline: portal.headline,
            welcomeMessage: portal.welcomeMessage,
            showPoweredBy: portal.showPoweredBy,
          }),
        });
        const data = (await res.json()) as {
          error?: string;
          portal?: SupplierPortalConfigView;
        };
        if (!res.ok) {
          note(data.error ?? "Could not save portal settings.", "error");
          return;
        }
        if (data.portal) setPortal(data.portal);
        note("Portal settings saved.", "ok");
      } catch {
        note("Network error while saving portal settings.", "error");
      }
    });
  }

  const previewVars = brandingCssVarsToInlineStyle(
    brandingToCssVars({
      primaryColor: initialBranding.primaryColor,
      secondaryColor: null,
      fontFamily: null,
      defaultMode: null,
      radius: null,
      logoId: null,
      logoUrl: initialBranding.logoUrl,
      domain: null,
    }),
  );

  const previewWelcome =
    portal.welcomeMessage?.trim() ||
    `For Acme Supplies. About 90 seconds. ${DEFAULT_PORTAL_WELCOME}`;

  return (
    <div className="mt-14 border-t border-rule pt-10">
      <div className="grid gap-10 lg:grid-cols-2">
        <section className="space-y-4">
          <p className="label-caps text-ink">Supplier portal</p>
          <p className="text-sm text-ink-muted">
            Customise the public invite form at{" "}
            <span className="font-data">/s/[token]</span>. Logo and accent colour come
            from dashboard branding above.
          </p>

          {!canEdit ? (
            <p className="border border-rule bg-surface-2 px-3 py-2 text-sm text-ink-muted">
              View-only. Ask an owner or admin to change portal settings.
            </p>
          ) : null}

          {status ? (
            <p
              className={cn(
                "text-sm",
                statusTone === "error" && "text-rust",
                statusTone === "ok" && "text-signal",
                statusTone === "neutral" && "text-ink-muted",
              )}
              role="status"
            >
              {status}
            </p>
          ) : null}

          <label className="flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              className="mt-1"
              checked={portal.enabled}
              disabled={!canEdit || pending}
              onChange={(e) => setPortal((p) => ({ ...p, enabled: e.target.checked }))}
            />
            <span>Portal enabled (invite links accept submissions)</span>
          </label>

          <AppField
            label="Headline"
            value={portal.headline}
            onChange={(e) => setPortal((p) => ({ ...p, headline: e.target.value }))}
            placeholder={DEFAULT_PORTAL_HEADLINE}
            disabled={!canEdit || pending}
          />

          <div className="space-y-1.5">
            <label className="label-caps text-ink-muted" htmlFor="portal-welcome">
              Welcome message
            </label>
            <textarea
              id="portal-welcome"
              rows={4}
              className="min-h-[6rem] w-full rounded-[var(--radius)] border border-rule bg-canvas px-3 py-2 text-sm text-ink"
              value={portal.welcomeMessage ?? ""}
              placeholder={DEFAULT_PORTAL_WELCOME}
              disabled={!canEdit || pending}
              onChange={(e) =>
                setPortal((p) => ({
                  ...p,
                  welcomeMessage: e.target.value,
                }))
              }
            />
          </div>

          <label className="flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              className="mt-1"
              checked={portal.showPoweredBy}
              disabled={!canEdit || pending}
              onChange={(e) =>
                setPortal((p) => ({ ...p, showPoweredBy: e.target.checked }))
              }
            />
            <span>Show “Powered by ClearESG” footer</span>
          </label>

          {canEdit ? (
            <Button type="button" onClick={save} disabled={pending}>
              Save portal
            </Button>
          ) : null}
        </section>

        <section>
          <p className="label-caps mb-3 text-ink">Portal preview</p>
          <div
            className="overflow-hidden rounded-[var(--radius-panel)] border border-rule bg-canvas shadow-[var(--shadow-float)]"
            style={previewVars}
            data-portal-preview
          >
            <div className="flex items-center gap-2 border-b border-rule bg-surface-1 px-3 py-2">
              {initialBranding.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={initialBranding.logoUrl}
                  alt=""
                  className="size-7 object-contain"
                />
              ) : (
                <div className="flex size-7 items-center justify-center rounded-[var(--radius-chip)] bg-accent text-[10px] font-medium text-on-accent">
                  {orgName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className="text-sm text-ink-muted">{orgName}</span>
              <span className="ml-auto text-[10px] uppercase tracking-wide text-ink-muted">
                Preview
              </span>
            </div>
            <div className="space-y-3 p-4">
              {!portal.enabled ? (
                <p className="text-sm text-amber">Portal paused — invites blocked.</p>
              ) : null}
              <h2
                className="text-2xl text-ink"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {portal.headline.trim() || DEFAULT_PORTAL_HEADLINE}
              </h2>
              <p className="text-sm text-ink-muted">{previewWelcome}</p>
              <div>
                <div className="flex justify-between text-xs text-ink-muted">
                  <span>Progress</span>
                  <span className="font-data">2/5</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-[var(--radius-chip)] bg-surface-2">
                  <div className="h-full w-2/5 bg-accent" />
                </div>
              </div>
              <button
                type="button"
                className="rounded-[var(--radius)] bg-accent px-3 py-2 text-sm font-medium text-on-accent"
              >
                Submit
              </button>
              {portal.showPoweredBy ? (
                <p className="border-t border-rule pt-3 text-xs text-ink-muted">
                  Powered by ClearESG
                </p>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
