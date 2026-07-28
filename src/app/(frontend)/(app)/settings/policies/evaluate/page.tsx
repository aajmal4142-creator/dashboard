"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageFrame, PageCard } from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { AppSelectNative } from "@/components/ui/AppField";
import { toast } from "sonner";
import type { Action } from "@/lib/policy/types";

const ACTIONS: Action[] = ["view", "create", "edit", "delete", "approve", "export"];
const RESOURCES = ["datapoint", "report", "supplier", "evidence", "audit", "policies"];
const SCOPES = ["own", "team", "organisation", "all"];

interface EvaluationResult {
  decision: "allowed" | "denied";
  reason: string;
  userRole?: string;
  capabilities?: Record<string, unknown>;
}

export default function EvaluatorPage() {
  const router = useRouter();
  const [users, setUsers] = useState<
    Array<{ id: string; email: string; firstName?: string; lastName?: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState<EvaluationResult | null>(null);

  const [form, setForm] = useState({
    userId: "",
    action: "view" as Action,
    resource: "datapoint",
    scope: "organisation" as "own" | "team" | "organisation" | "all",
  });

  useEffect(() => {
    async function loadUsers() {
      try {
        setLoading(true);
        const res = await fetch("/api/users");
        if (res.status === 403) {
          toast.error("Admin access required");
          router.push("/");
          return;
        }
        if (res.ok) {
          const data = (await res.json()) as {
            docs?: Array<{
              id: string;
              email: string;
              firstName?: string;
              lastName?: string;
            }>;
          };
          setUsers(data.docs || []);
        }
      } catch {
        toast.error("Failed to load users");
      } finally {
        setLoading(false);
      }
    }

    void loadUsers();
  }, [router]);

  async function handleEvaluate() {
    if (!form.userId) {
      toast.error("Select a user");
      return;
    }

    try {
      setEvaluating(true);
      const res = await fetch("/api/app/policies/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: form.userId,
          action: form.action,
          resource: form.resource,
          scope: form.scope,
        }),
      });

      if (res.status === 403) {
        toast.error("Admin access required");
        router.push("/");
        return;
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Evaluation failed");
      }

      const data = await res.json();
      setResult(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to evaluate policy");
    } finally {
      setEvaluating(false);
    }
  }

  if (loading) {
    return (
      <PageFrame eyebrow="Settings" title="Policy Evaluator">
        <PageCard>
          <div className="py-8 text-center">Loading...</div>
        </PageCard>
      </PageFrame>
    );
  }

  return (
    <PageFrame
      eyebrow="Settings"
      title="Policy Evaluator"
      help="Test if a user can perform a specific action (dry-run)"
    >
      <PageCard>
        <div className="space-y-6 max-w-2xl">
          {/* Form */}
          <div className="space-y-4">
            <div>
              <AppSelectNative
                label="Select User"
                value={form.userId}
                onChange={(e) => setForm({ ...form, userId: e.target.value })}
              >
                <option value="">Choose a user...</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.firstName} {user.lastName} ({user.email})
                  </option>
                ))}
              </AppSelectNative>
            </div>

            <div>
              <AppSelectNative
                label="Action"
                value={form.action}
                onChange={(e) => setForm({ ...form, action: e.target.value as Action })}
              >
                {ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </AppSelectNative>
            </div>

            <div>
              <AppSelectNative
                label="Resource"
                value={form.resource}
                onChange={(e) => setForm({ ...form, resource: e.target.value })}
              >
                {RESOURCES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </AppSelectNative>
            </div>

            <div>
              <AppSelectNative
                label="Scope"
                value={form.scope}
                onChange={(e) =>
                  setForm({
                    ...form,
                    scope: e.target.value as "own" | "team" | "organisation" | "all",
                  })
                }
              >
                {SCOPES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </AppSelectNative>
            </div>
          </div>

          <Button onClick={handleEvaluate} disabled={evaluating || !form.userId}>
            {evaluating ? "Evaluating..." : "Evaluate"}
          </Button>

          {/* Result */}
          {result && (
            <div className="space-y-4 rounded border border-rule-soft p-6 bg-surface-2">
              <div>
                <div
                  className={`inline-block px-4 py-2 rounded font-bold text-lg ${
                    result.decision === "allowed"
                      ? "bg-signal/20 text-signal"
                      : "bg-rust/20 text-rust"
                  }`}
                >
                  {result.decision === "allowed" ? "✅ ALLOWED" : "❌ DENIED"}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-ink-softer">Reason</p>
                <p className="text-sm mt-1">{result.reason}</p>
              </div>

              {result.userRole && (
                <div>
                  <p className="text-sm font-semibold text-ink-softer">User Role</p>
                  <p className="text-sm mt-1 font-mono">{result.userRole}</p>
                </div>
              )}

              {result.capabilities && Object.keys(result.capabilities).length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-ink-softer mb-2">
                    User Capabilities
                  </p>
                  <div className="max-h-60 overflow-y-auto space-y-1">
                    {Object.entries(result.capabilities).map(([key]) => (
                      <div
                        key={key}
                        className="text-sm font-mono bg-surface-1 px-2 py-1 rounded"
                      >
                        {key}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </PageCard>
    </PageFrame>
  );
}
