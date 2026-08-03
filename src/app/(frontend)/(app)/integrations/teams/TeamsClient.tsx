"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { TeamsIntegrationSummary } from "@/lib/integrations/teams";

type StatusMessage = { type: "success" | "error"; text: string };

export function TeamsClient(props: {
  canManage: boolean;
  initialIntegration: TeamsIntegrationSummary | null;
}) {
  const [integration, setIntegration] = useState(props.initialIntegration);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [channelLabel, setChannelLabel] = useState(
    props.initialIntegration?.channelLabel ?? "",
  );
  const [enabled, setEnabled] = useState(props.initialIntegration?.enabled !== false);
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  const connected = integration?.status === "connected" && integration.hasWebhook;

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/app/integrations/teams");
      const data = (await res.json()) as {
        integration?: TeamsIntegrationSummary | null;
        error?: string;
      };
      if (!res.ok) {
        setMessage({
          type: "error",
          text: data.error || "Failed to load Teams settings.",
        });
        return;
      }
      setIntegration(data.integration ?? null);
      setChannelLabel(data.integration?.channelLabel ?? "");
      setEnabled(data.integration?.enabled !== false);
    } catch {
      setMessage({ type: "error", text: "Failed to load Teams settings." });
    } finally {
      setLoading(false);
    }
  }

  function connect() {
    startTransition(async () => {
      setMessage(null);
      try {
        const res = await fetch("/api/app/integrations/teams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            webhookUrl,
            channelLabel: channelLabel.trim() || null,
            enabled,
          }),
        });
        const data = (await res.json()) as {
          integration?: TeamsIntegrationSummary;
          error?: string;
        };
        if (!res.ok) {
          setMessage({
            type: "error",
            text: data.error || "Failed to save Teams webhook.",
          });
          return;
        }
        setIntegration(data.integration ?? null);
        setWebhookUrl("");
        setMessage({
          type: "success",
          text: "Teams Incoming Webhook connected. URLs are never shown again after save.",
        });
      } catch {
        setMessage({ type: "error", text: "Connect request failed." });
      }
    });
  }

  function saveSettings() {
    startTransition(async () => {
      setMessage(null);
      try {
        const res = await fetch("/api/app/integrations/teams", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channelLabel: channelLabel.trim() || null,
            enabled,
          }),
        });
        const data = (await res.json()) as {
          integration?: TeamsIntegrationSummary;
          error?: string;
        };
        if (!res.ok) {
          setMessage({
            type: "error",
            text: data.error || "Failed to update Teams settings.",
          });
          return;
        }
        setIntegration(data.integration ?? null);
        setMessage({ type: "success", text: "Teams settings saved." });
      } catch {
        setMessage({ type: "error", text: "Failed to update Teams settings." });
      }
    });
  }

  function disconnect() {
    startTransition(async () => {
      setMessage(null);
      try {
        const res = await fetch("/api/app/integrations/teams", {
          method: "DELETE",
        });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          setMessage({
            type: "error",
            text: data.error || "Disconnect failed.",
          });
          return;
        }
        setIntegration(null);
        setWebhookUrl("");
        setChannelLabel("");
        setEnabled(true);
        setMessage({ type: "success", text: "Teams webhook disconnected." });
      } catch {
        setMessage({ type: "error", text: "Disconnect failed." });
      }
    });
  }

  function testWebhook() {
    startTransition(async () => {
      setMessage(null);
      try {
        const body: { webhookUrl?: string } = {};
        if (webhookUrl.trim()) {
          body.webhookUrl = webhookUrl.trim();
        }
        const res = await fetch("/api/app/integrations/teams/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) {
          setMessage({
            type: "error",
            text: data.error || "Test post failed.",
          });
          void refresh();
          return;
        }
        setMessage({
          type: "success",
          text: "Test MessageCard posted to the Teams channel.",
        });
        void refresh();
      } catch {
        setMessage({ type: "error", text: "Test request failed." });
      }
    });
  }

  if (loading && !integration && !props.initialIntegration) {
    return <p className="text-sm text-ink-muted">Loading Teams settings…</p>;
  }

  return (
    <div className="space-y-6">
      {message ? (
        <p
          className={
            message.type === "success"
              ? "border-t border-rule pt-3 text-sm text-signal"
              : "border-t border-rule pt-3 text-sm text-rust"
          }
          role="status"
        >
          {message.text}
        </p>
      ) : null}

      <div className="panel border border-amber p-6">
        <h2 className="text-lg font-semibold text-ink">Incoming Webhook required</h2>
        <p className="mt-2 text-sm text-ink-muted">
          In Microsoft Teams, open the target channel → Connectors / Workflows → Incoming
          Webhook (or a Power Automate “Post to a channel when a webhook request is
          received” flow). Paste the HTTPS URL below. ClearESG does not use Microsoft
          Graph or Bot Framework — there is no paid Teams API dependency.
        </p>
      </div>

      <div className="panel p-6">
        <h2 className="text-lg font-semibold text-ink">Connection</h2>
        <div className="title-rule mt-2" />

        {connected && integration ? (
          <div className="mt-4 space-y-2 text-sm">
            <p className="text-ink">
              Status:{" "}
              <span className="font-medium text-signal">
                {integration.enabled ? "Connected" : "Connected (paused)"}
              </span>
            </p>
            <p className="text-ink-muted">
              Channel label:{" "}
              <span className="font-mono text-ink">
                {integration.channelLabel || "not set"}
              </span>
            </p>
            {integration.connectedAt ? (
              <p className="text-ink-muted">
                Connected{" "}
                <span className="font-mono">
                  {new Date(integration.connectedAt).toLocaleString()}
                </span>
              </p>
            ) : null}
            {integration.lastTestedAt ? (
              <p className="text-ink-muted">
                Last tested{" "}
                <span className="font-mono">
                  {new Date(integration.lastTestedAt).toLocaleString()}
                </span>
              </p>
            ) : null}
            {integration.lastError ? (
              <p className="text-rust">{integration.lastError}</p>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink-muted">
            No Teams Incoming Webhook connected for this organisation.
          </p>
        )}

        {props.canManage ? (
          <div className="mt-6 space-y-4">
            <label className="block text-sm text-ink">
              <span className="label-caps text-ink-muted">
                Incoming Webhook URL{connected ? " (replace)" : ""}
              </span>
              <input
                type="url"
                className="mt-1 w-full rounded border border-rule bg-surface-1 px-3 py-2 font-mono text-sm text-ink"
                placeholder="https://….webhook.office.com/webhookb2/…"
                value={webhookUrl}
                disabled={pending}
                onChange={(e) => setWebhookUrl(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </label>

            <label className="block text-sm text-ink">
              <span className="label-caps text-ink-muted">Channel label (optional)</span>
              <input
                type="text"
                className="mt-1 w-full rounded border border-rule bg-surface-1 px-3 py-2 text-sm text-ink"
                placeholder="e.g. #esg-alerts"
                value={channelLabel}
                disabled={pending}
                onChange={(e) => setChannelLabel(e.target.value)}
              />
            </label>

            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={enabled}
                disabled={pending}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              Enabled — post when alert rules fire{" "}
              <span className="font-mono text-ink-muted">post_teams</span>
            </label>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={pending || !webhookUrl.trim()}
                onClick={connect}
              >
                {connected ? "Replace webhook" : "Connect webhook"}
              </Button>
              {connected ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pending}
                    onClick={saveSettings}
                  >
                    Save settings
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pending || (!webhookUrl.trim() && !connected)}
                    onClick={testWebhook}
                  >
                    Send test
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={pending}
                    onClick={disconnect}
                  >
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending || !webhookUrl.trim()}
                  onClick={testWebhook}
                >
                  Send test
                </Button>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-6 text-sm text-ink-muted">
            Owner or admin role required to manage Teams.
          </p>
        )}

        <div className="mt-6">
          <Link
            href="/integrations"
            className="inline-flex h-9 items-center rounded border border-rule px-4 text-sm text-ink hover:border-rule-strong"
          >
            Back to integrations
          </Link>
        </div>
      </div>

      <div className="panel p-6">
        <h2 className="text-lg font-semibold text-ink">Alert actions</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Enable the <span className="font-mono">Teams</span> action on an alert rule
          under Alerts. When the rule triggers, ClearESG POSTs a MessageCard to this
          webhook. High-emissions and data-quality rules use the same path.
        </p>
      </div>
    </div>
  );
}
