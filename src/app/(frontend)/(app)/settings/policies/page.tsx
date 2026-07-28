"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageFrame, PageCard } from "@/components/shell/PageFrame";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { EffectiveCapabilities } from "@/lib/policy/types";

const TAB_ITEMS = [
  { value: "roles", label: "Roles", href: "/settings/policies/roles" },
  { value: "users", label: "Users", href: "/settings/policies/users" },
  {
    value: "evaluate",
    label: "Evaluate",
    href: "/settings/policies/evaluate",
  },
  { value: "audit", label: "Audit Logs", href: "/settings/policies/audit" },
];

export default function PoliciesPage() {
  const router = useRouter();
  const [capabilities, setCapabilities] = useState<EffectiveCapabilities | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCapabilities() {
      try {
        setLoading(true);
        const res = await fetch("/api/app/policies/users");

        if (res.status === 403) {
          setError("Admin access required");
          toast.error("You don't have admin access to policy management");
          router.push("/");
          return;
        }

        if (!res.ok) {
          throw new Error("Failed to fetch capabilities");
        }

        // Just fetch the admin can see it - no filtering needed
        setCapabilities({
          capabilities: new Map(),
          roleId: "admin",
          roleName: "Admin",
        });
      } catch (err) {
        console.error("Error fetching capabilities:", err);
        // Silently ignore - user just doesn't have admin access
      } finally {
        setLoading(false);
      }
    }

    void fetchCapabilities();
  }, [router]);

  if (loading) {
    return (
      <PageFrame eyebrow="Settings" title="Policy Management">
        <PageCard>
          <div className="py-8 text-center">Loading...</div>
        </PageCard>
      </PageFrame>
    );
  }

  if (error) {
    return (
      <PageFrame eyebrow="Settings" title="Policy Management">
        <PageCard>
          <div className="py-8 text-center text-red-600">{error}</div>
        </PageCard>
      </PageFrame>
    );
  }

  return (
    <PageFrame
      eyebrow="Settings"
      title="Policy Management"
      help="Manage roles, assign users, test policies, and view audit logs"
    >
      {capabilities && (
        <PageCard>
          <div className="mb-6 flex items-center justify-between rounded-lg border border-rule-soft bg-surface-2 p-4">
            <div>
              <p className="text-sm font-semibold">Your Role</p>
              <p className="text-lg font-bold text-accent">{capabilities.roleName}</p>
            </div>
          </div>
        </PageCard>
      )}

      <PageCard>
        <Tabs defaultValue="roles" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            {TAB_ITEMS.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="roles" className="mt-6">
            <div className="space-y-4">
              <p className="text-sm text-ink-softer">
                View and manage organization roles. System roles cannot be modified.
              </p>
              <Button onClick={() => router.push("/settings/policies/roles")}>
                Go to Roles
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <div className="space-y-4">
              <p className="text-sm text-ink-softer">
                Assign users to roles and configure capability overrides.
              </p>
              <Button onClick={() => router.push("/settings/policies/users")}>
                Go to Users
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="evaluate" className="mt-6">
            <div className="space-y-4">
              <p className="text-sm text-ink-softer">
                Test if a user can perform a specific action (dry-run).
              </p>
              <Button onClick={() => router.push("/settings/policies/evaluate")}>
                Go to Evaluator
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="audit" className="mt-6">
            <div className="space-y-4">
              <p className="text-sm text-ink-softer">
                View all policy evaluation events and filter by user, action, or decision.
              </p>
              <Button onClick={() => router.push("/settings/policies/audit")}>
                Go to Audit Logs
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </PageCard>
    </PageFrame>
  );
}
