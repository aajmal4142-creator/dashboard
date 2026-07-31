"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type {
  SlackChannelOption,
  SlackIntegrationSummary,
} from "@/lib/integrations/slack";

type StatusMessage = { type: "success" | "error"; text: string };

export function SlackClient(props: {
  canManage: boolean;
  configured: boolean;
  initialIntegration: SlackIntegrationSummary | null;
}) {
  const searchParams = useSearchParams();
  const [integration, setIntegration] = useState(props.initialIntegration);
  const [configured, setConfigured] = useState(props.configured);
  const [channels, setChannels] = useState<SlackChannelOption[]>([]);
  const [channelId, setChannelId] = useState(
    props.initialIntegration?.defaultChannelId ?? "",
  );
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [pending, startTransition] = useTransition();
  const [loadingChannels, setLoadingChannels] = useState(false);

  const connected = integration?.status === "connected";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const connectedParam = searchParams.get("connected");
      const error = searchParams.get("error");
      const team = searchParams.get("team");
      if (connectedParam === "true") {
        setMessage({
          type: "success",
          text: team
            ? `Slack workspace ${team} connected.`
            : "Slack workspace connected.",
        });
        void refresh();
      } else if (error) {
        setMessage({ type: "error", text: error });
      }
    }, 0);
    return () => window.clearTimeout(timer);
    // Querystring is only meaningful on first paint after OAuth redirect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!(connected && props.canManage)) return;
    const timer = window.setTimeout(() => {
      void loadChannels();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [connected, props.canManage]);

  async function refresh() {
    const res = await fetch("/api/app/integrations/slack");
    const data = (await res.json()) as {
      configured?: boolean;
      integration?: SlackIntegrationSummary | null;
    };
    setConfigured(Boolean(data.configured));
    setIntegration(data.integration ?? null);
    setChannelId(data.integration?.defaultChannelId ?? "");
  }

  async function loadChannels() {
    setLoadingChannels(true);
    try {
      const res = await fetch("/api/app/integrations/slack/channels");
      const data = (await res.json()) as {
        channels?: SlackChannelOption[];
        error?: string;
      };
      if (!res.ok) {
        setMessage({
          type: "error",
          text: data.error || "Failed to list Slack channels.",
        });
        return;
      }
      setChannels(data.channels ?? []);
    } catch {
      setMessage({ type: "error", text: "Failed to list Slack channels." });
    } finally {
      setLoadingChannels(false);
    }
  }

  function connect() {
    startTransition(async () => {
      setMessage(null);
      try {
        const res = await fetch("/api/app/integrations/slack/install", {
          method: "POST",
        });
        const data = (await res.json()) as {
          authUrl?: string;
          error?: string;
          configured?: boolean;
        };
        if (!res.ok || !data.authUrl) {
          if (data.configured === false) setConfigured(false);
          setMessage({
            type: "error",
            text: data.error || "Configure Slack app credentials before installing.",
          });
          return;
        }
        window.location.href = data.authUrl;
      } catch {
        setMessage({ type: "error", text: "Install request failed." });
      }
    });
  }

  function disconnect() {
    startTransition(async () => {
      setMessage(null);
      try {
        const res = await fetch("/api/app/integrations/slack", {
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
        setChannels([]);
        setChannelId("");
        setMessage({ type: "success", text: "Slack disconnected." });
      } catch {
        setMessage({ type: "error", text: "Disconnect failed." });
      }
    });
  }

  function saveChannel() {
    startTransition(async () => {
      setMessage(null);
      const selected = channels.find((c) => c.id === channelId);
      try {
        const res = await fetch("/api/app/integrations/slack", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            defaultChannelId: channelId || null,
            defaultChannelName: selected ? `#${selected.name}` : null,
          }),
        });
        const data = (await res.json()) as {
          integration?: SlackIntegrationSummary;
          error?: string;
        };
        if (!res.ok) {
          setMessage({
            type: "error",
            text: data.error || "Failed to save channel.",
          });
          return;
        }
        setIntegration(data.integration ?? null);
        setMessage({ type: "success", text: "Default channel saved." });
      } catch {
        setMessage({ type: "error", text: "Failed to save channel." });
      }
    });
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

      {!configured ? (
        <div className="panel border border-amber p-6">
          <h2 className="text-lg font-semibold text-ink">
            Configure Slack app credentials
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            Set <span className="font-mono text-ink">SLACK_CLIENT_ID</span>,{" "}
            <span className="font-mono text-ink">SLACK_CLIENT_SECRET</span>, and{" "}
            <span className="font-mono text-ink">SLACK_SIGNING_SECRET</span> in the
            environment, then restart the app. Install and channel posting stay disabled
            until those values are present.
          </p>
          <p className="mt-3 text-sm text-ink-muted">
            Redirect URL for the Slack app:{" "}
            <span className="font-mono text-[12px] text-ink">
              /api/app/integrations/slack/callback
            </span>
          </p>
        </div>
      ) : null}

      <div className="panel p-6">
        <h2 className="text-lg font-semibold text-ink">Workspace</h2>
        <div className="title-rule mt-2" />

        {connected && integration ? (
          <div className="mt-4 space-y-2 text-sm">
            <p className="text-ink">
              Connected to{" "}
              <span className="font-medium">
                {integration.teamName || integration.teamId || "workspace"}
              </span>
            </p>
            <p className="text-ink-muted">
              Default channel:{" "}
              <span className="font-mono text-ink">
                {integration.defaultChannelName ||
                  integration.defaultChannelId ||
                  "not set"}
              </span>
            </p>
            {integration.installedAt ? (
              <p className="text-ink-muted">
                Installed{" "}
                <span className="font-mono">
                  {new Date(integration.installedAt).toLocaleString()}
                </span>
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink-muted">
            No Slack workspace connected for this organisation.
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {props.canManage ? (
            <>
              <Button type="button" disabled={pending || !configured} onClick={connect}>
                {connected ? "Reinstall" : "Connect Slack"}
              </Button>
              {connected ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={disconnect}
                >
                  Disconnect
                </Button>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-ink-muted">
              Owner or admin role required to manage Slack.
            </p>
          )}
          <Link
            href="/integrations"
            className="inline-flex h-9 items-center rounded border border-rule px-4 text-sm text-ink hover:border-rule-strong"
          >
            Back to integrations
          </Link>
        </div>
      </div>

      {connected && props.canManage ? (
        <div className="panel p-6">
          <h2 className="text-lg font-semibold text-ink">Default channel</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Alert <span className="font-mono">post_slack</span> actions post here when no
            event-specific mapping is set. Invite the ClearESG bot to the channel after
            selecting it.
          </p>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="block min-w-[12rem] flex-1 text-sm text-ink">
              <span className="label-caps text-ink-muted">Channel</span>
              <select
                className="mt-1 w-full rounded border border-rule bg-surface-1 px-3 py-2 text-sm text-ink"
                value={channelId}
                disabled={pending || loadingChannels}
                onChange={(e) => setChannelId(e.target.value)}
              >
                <option value="">Select a channel</option>
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.isPrivate ? `(private) ${ch.name}` : `#${ch.name}`}
                  </option>
                ))}
              </select>
            </label>
            <Button type="button" disabled={pending || !channelId} onClick={saveChannel}>
              Save channel
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending || loadingChannels}
              onClick={() => void loadChannels()}
            >
              Refresh list
            </Button>
          </div>
          {loadingChannels ? (
            <p className="mt-2 text-sm text-ink-muted">Loading channels…</p>
          ) : null}
        </div>
      ) : null}

      <div className="panel p-6">
        <h2 className="text-lg font-semibold text-ink">Request endpoints</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Point the Slack app Event Subscriptions, Slash Commands, and Interactivity URLs
          at these paths. Requests are signature-verified; handlers are stubs.
        </p>
        <ul className="mt-3 space-y-1 font-mono text-[12px] text-ink">
          <li>/api/app/integrations/slack/events</li>
          <li>/api/app/integrations/slack/commands</li>
          <li>/api/app/integrations/slack/interactions</li>
        </ul>
      </div>
    </div>
  );
}
