"use client";

import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { AppField, AppSelectNative, AppColorField } from "@/components/ui/AppField";
import {
  BRAND_FONT_OPTIONS,
  BRAND_RADIUS_OPTIONS,
  brandingCssVarsToInlineStyle,
  brandingToCssVars,
  isHexColor,
  type BrandFontKey,
  type BrandModeKey,
  type BrandRadiusKey,
  type OrgBranding,
} from "@/lib/branding";
import { cn } from "@/lib/utils";

type Props = {
  initial: OrgBranding;
  canEdit: boolean;
  orgName: string;
  isConsultancy: boolean;
};

type Draft = {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: BrandFontKey | "";
  defaultMode: BrandModeKey | "";
  radius: BrandRadiusKey | "";
  domain: string;
  logoUrl: string | null;
  logoId: string | null;
  logoRemoved: boolean;
};

function toDraft(b: OrgBranding): Draft {
  return {
    primaryColor: b.primaryColor ?? "",
    secondaryColor: b.secondaryColor ?? "",
    fontFamily: b.fontFamily ?? "",
    defaultMode: b.defaultMode ?? "",
    radius: b.radius ?? "",
    domain: b.domain ?? "",
    logoUrl: b.logoUrl,
    logoId: b.logoId,
    logoRemoved: false,
  };
}

export function SettingsThemeClient({ initial, canEdit, orgName, isConsultancy }: Props) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"ok" | "error" | "neutral">("neutral");
  const [pending, startTransition] = useTransition();

  const previewVars = useMemo(() => {
    const vars = brandingToCssVars({
      primaryColor: isHexColor(draft.primaryColor) ? draft.primaryColor : null,
      secondaryColor: isHexColor(draft.secondaryColor) ? draft.secondaryColor : null,
      fontFamily: draft.fontFamily || null,
      radius: draft.radius || null,
      defaultMode: draft.defaultMode || null,
      logoId: draft.logoId,
      logoUrl: draft.logoUrl,
      domain: draft.domain || null,
    });
    const style = brandingCssVarsToInlineStyle(vars);
    if (vars["--font-sans"]) {
      style.fontFamily = "var(--font-sans), system-ui, sans-serif";
    }
    return style;
  }, [draft]);

  function note(message: string, tone: "ok" | "error" | "neutral" = "neutral") {
    setStatus(message);
    setStatusTone(tone);
  }

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function save() {
    if (!canEdit) {
      note("Only owners and admins can change branding.", "error");
      return;
    }
    if (draft.primaryColor && !isHexColor(draft.primaryColor)) {
      note("Primary colour must be #RRGGBB.", "error");
      return;
    }
    if (draft.secondaryColor && !isHexColor(draft.secondaryColor)) {
      note("Secondary colour must be #RRGGBB.", "error");
      return;
    }

    note("Saving…", "neutral");
    const res = await fetch("/api/app/settings/branding", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        primaryColor: draft.primaryColor.trim() || null,
        secondaryColor: draft.secondaryColor.trim() || null,
        fontFamily: draft.fontFamily || null,
        defaultMode: draft.defaultMode || null,
        radius: draft.radius || null,
        domain: isConsultancy ? draft.domain.trim() || null : undefined,
        ...(draft.logoRemoved
          ? { clearLogo: true }
          : draft.logoId
            ? { logoId: draft.logoId }
            : {}),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      branding?: OrgBranding;
    };
    if (!res.ok) {
      note(data.error ?? "Save failed.", "error");
      return;
    }
    if (data.branding) setDraft(toDraft(data.branding));
    note("Saved. Reloading dashboard chrome…", "ok");
    startTransition(() => {
      window.location.reload();
    });
  }

  async function onLogoChange(file: File | null) {
    if (!canEdit || !file) return;
    note("Uploading logo…", "neutral");
    const form = new FormData();
    form.set("file", file);
    const res = await fetch("/api/app/settings/branding/logo", {
      method: "POST",
      body: form,
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      logoId?: string;
      logoUrl?: string | null;
      branding?: OrgBranding;
    };
    if (!res.ok) {
      note(data.error ?? "Logo upload failed.", "error");
      return;
    }
    if (data.branding) {
      setDraft(toDraft(data.branding));
    } else {
      setDraft((d) => ({
        ...d,
        logoId: data.logoId ?? null,
        logoUrl: data.logoUrl ?? null,
        logoRemoved: false,
      }));
    }
    note(
      "Logo uploaded. Click Save colours / type to keep other fields, or reload.",
      "ok",
    );
  }

  function clearLogo() {
    update("logoId", null);
    update("logoUrl", null);
    update("logoRemoved", true);
  }

  return (
    <div className="mt-6 grid gap-10 lg:grid-cols-2">
      <section className="space-y-4">
        <p className="label-caps text-ink">Dashboard branding</p>
        <p className="text-sm text-ink-muted">
          Applies to the signed-in dashboard only — not the marketing site. Leave colours
          blank to keep ClearESG defaults.
        </p>

        {!canEdit ? (
          <p className="border border-rule bg-surface-2 px-3 py-2 text-sm text-ink-muted">
            View-only. Ask an owner or admin to change branding.
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

        <div className="grid gap-3 sm:grid-cols-2">
          <AppColorField
            label="Primary colour"
            value={draft.primaryColor}
            onChange={(hex) => update("primaryColor", hex)}
            placeholder="#7A2E2E"
            fallback="#7A2E2E"
            disabled={!canEdit || pending}
          />
          <AppColorField
            label="Secondary colour"
            value={draft.secondaryColor}
            onChange={(hex) => update("secondaryColor", hex)}
            placeholder="#6B635A"
            fallback="#6B635A"
            disabled={!canEdit || pending}
          />
        </div>

        <AppSelectNative
          label="Font"
          value={draft.fontFamily}
          onChange={(e) => update("fontFamily", e.target.value as BrandFontKey | "")}
          disabled={!canEdit || pending}
        >
          <option value="">ClearESG default</option>
          {BRAND_FONT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </AppSelectNative>

        <div className="grid gap-3 sm:grid-cols-2">
          <AppSelectNative
            label="Default appearance"
            value={draft.defaultMode}
            onChange={(e) => update("defaultMode", e.target.value as BrandModeKey | "")}
            disabled={!canEdit || pending}
          >
            <option value="">User preference</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </AppSelectNative>
          <AppSelectNative
            label="Corner style"
            value={draft.radius}
            onChange={(e) => update("radius", e.target.value as BrandRadiusKey | "")}
            disabled={!canEdit || pending}
          >
            <option value="">ClearESG default</option>
            {BRAND_RADIUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </AppSelectNative>
        </div>

        {isConsultancy ? (
          <AppField
            label="Custom domain"
            value={draft.domain}
            onChange={(e) => update("domain", e.target.value)}
            placeholder="esg.yourfirm.com"
            disabled={!canEdit || pending}
          />
        ) : null}

        <div className="space-y-2">
          <p className="label-caps">Logo</p>
          {draft.logoUrl ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={draft.logoUrl}
                alt=""
                className="size-12 rounded-[var(--radius)] border border-rule object-contain bg-surface-1 p-1"
              />
              {canEdit ? (
                <button
                  type="button"
                  className="text-sm text-ink-muted underline-offset-2 hover:text-ink hover:underline"
                  onClick={clearLogo}
                  disabled={pending}
                >
                  Remove
                </button>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-ink-muted">
              No logo — initials shown in the shell.
            </p>
          )}
          {canEdit ? (
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
              className="block w-full text-sm text-ink-muted file:mr-3 file:border file:border-rule file:bg-surface-1 file:px-3 file:py-1.5 file:text-ink"
              disabled={pending}
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                void onLogoChange(file);
                e.target.value = "";
              }}
            />
          ) : null}
        </div>

        {canEdit ? (
          <Button type="button" onClick={() => void save()} disabled={pending}>
            Save branding
          </Button>
        ) : null}
      </section>

      <section>
        <p className="label-caps mb-3 text-ink">Live preview</p>
        <div
          className="overflow-hidden rounded-[var(--radius-panel)] border border-rule bg-canvas shadow-[var(--shadow-float)]"
          style={previewVars}
          data-theme-preview
        >
          <div className="flex items-center gap-2 border-b border-rule bg-surface-1 px-3 py-2">
            {draft.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.logoUrl} alt="" className="size-7 object-contain" />
            ) : (
              <div className="flex size-7 items-center justify-center rounded-[var(--radius-chip)] bg-accent text-[10px] font-medium text-on-accent">
                {orgName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <span
              className="text-sm text-ink"
              style={
                draft.fontFamily
                  ? { fontFamily: "var(--font-display), system-ui, sans-serif" }
                  : undefined
              }
            >
              {orgName}
            </span>
            <span className="ml-auto text-[10px] uppercase tracking-wide text-ink-muted">
              Preview
            </span>
          </div>
          <div className="space-y-4 p-4">
            <div>
              <p className="label-caps">Reporting period</p>
              <h2
                className="text-2xl text-ink"
                style={
                  draft.fontFamily
                    ? { fontFamily: "var(--font-display), system-ui, sans-serif" }
                    : undefined
                }
              >
                Dashboard chrome
              </h2>
              <div className="title-rule mt-2" />
            </div>
            <p className="text-sm text-ink-muted">
              Primary buttons, nav accents, and type use your branding tokens. Data
              colours stay fixed for accessibility.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-[var(--radius)] bg-accent px-3 py-2 text-sm font-medium text-on-accent"
              >
                Primary action
              </button>
              <button
                type="button"
                className="rounded-[var(--radius)] border border-rule px-3 py-2 text-sm text-ink"
              >
                Secondary
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 border-t border-rule pt-3">
              <div>
                <p className="label-caps">Primary</p>
                <p className="font-data text-sm text-ink">
                  {isHexColor(draft.primaryColor) ? draft.primaryColor : "default"}
                </p>
              </div>
              <div>
                <p className="label-caps">Secondary</p>
                <p
                  className="font-data text-sm"
                  style={{
                    color: isHexColor(draft.secondaryColor)
                      ? draft.secondaryColor
                      : "var(--ink-muted)",
                  }}
                >
                  {isHexColor(draft.secondaryColor) ? draft.secondaryColor : "—"}
                </p>
              </div>
              <div>
                <p className="label-caps">Font</p>
                <p className="text-sm text-ink">
                  {BRAND_FONT_OPTIONS.find((o) => o.value === draft.fontFamily)?.label ??
                    "Default"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
