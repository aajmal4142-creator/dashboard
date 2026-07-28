"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageFrame, PageCard, StatusLine } from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { AppSelectNative } from "@/components/ui/AppField";
import { toast } from "sonner";
import type { PolicyRole, Capability, UserPolicy } from "@/lib/policy/types";

const ACTIONS = ["view", "create", "edit", "delete", "approve", "export"];
const RESOURCES = ["datapoint", "report", "supplier", "evidence", "audit", "policies"];
const SCOPES = ["own", "team", "organisation", "all"];

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<
    Array<{ id: string; email: string; firstName?: string; lastName?: string }>
  >([]);
  const [roles, setRoles] = useState<PolicyRole[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"neutral" | "error" | "ok">("neutral");
  const [baseRole, setBaseRole] = useState("");
  const [grantExtra, setGrantExtra] = useState<Capability[]>([]);
  const [revokeCapability, setRevokeCapability] = useState<Capability[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        // Fetch users
        const usersRes = await fetch("/api/users");
        if (usersRes.ok) {
          const usersData = (await usersRes.json()) as {
            docs?: Array<{
              id: string;
              email: string;
              firstName?: string;
              lastName?: string;
            }>;
          };
          setUsers(usersData.docs || []);
        }

        // Fetch roles
        const rolesRes = await fetch("/api/app/policies/roles");
        if (rolesRes.status === 403) {
          toast.error("Admin access required");
          router.push("/");
          return;
        }
        if (rolesRes.ok) {
          const rolesData = (await rolesRes.json()) as PolicyRole[];
          setRoles(rolesData);
        }
      } catch {
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [router]);

  async function handleSelectUser(userId: string) {
    if (!userId) {
      setSelectedUserId("");
      setSelectedUser(null);
      return;
    }

    try {
      const res = await fetch("/api/app/policies/users");
      if (!res.ok) throw new Error("Failed to fetch user policies");

      const policies = await res.json();
      const userPolicy = policies.find(
        (p: Record<string, string>) => p.userId === userId,
      );

      setSelectedUserId(userId);
      setSelectedUser(userPolicy || null);

      if (userPolicy) {
        setBaseRole(userPolicy.role.name.toLowerCase());
        setGrantExtra([]);
        setRevokeCapability([]);
      } else {
        setBaseRole("");
        setGrantExtra([]);
        setRevokeCapability([]);
      }

      setStatus(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load user policy");
    }
  }

  function addGrantRow() {
    setGrantExtra([
      ...grantExtra,
      {
        action: "view" as const,
        resource: "datapoint",
        scope: "organisation" as const,
      },
    ]);
  }

  function removeGrantRow(index: number) {
    setGrantExtra(grantExtra.filter((_, i) => i !== index));
  }

  function updateGrantRow(
    index: number,
    field: "action" | "resource" | "scope",
    value: string,
  ) {
    const updated = [...grantExtra];
    updated[index] = {
      ...updated[index],
      [field]: value,
    } as Capability;
    setGrantExtra(updated);
  }

  function addRevokeRow() {
    setRevokeCapability([
      ...revokeCapability,
      {
        action: "view" as const,
        resource: "datapoint",
        scope: "organisation" as const,
      },
    ]);
  }

  function removeRevokeRow(index: number) {
    setRevokeCapability(revokeCapability.filter((_, i) => i !== index));
  }

  function updateRevokeRow(
    index: number,
    field: "action" | "resource" | "scope",
    value: string,
  ) {
    const updated = [...revokeCapability];
    updated[index] = {
      ...updated[index],
      [field]: value,
    } as Capability;
    setRevokeCapability(updated);
  }

  async function handleSave() {
    if (!selectedUserId || !baseRole) {
      setStatus("Select user and base role");
      setStatusTone("error");
      return;
    }

    try {
      const res = await fetch(`/api/app/policies/users/${selectedUserId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseRole,
          capabilityOverrides: {
            grantExtra: grantExtra.length > 0 ? grantExtra : undefined,
            revokeCapability: revokeCapability.length > 0 ? revokeCapability : undefined,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update");
      }

      setStatus("User policy updated");
      setStatusTone("ok");
      toast.success("User policy updated");

      // Reload
      await handleSelectUser(selectedUserId);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update policy");
      setStatusTone("error");
    }
  }

  if (loading) {
    return (
      <PageFrame eyebrow="Settings" title="User Assignments">
        <PageCard>
          <div className="py-8 text-center">Loading...</div>
        </PageCard>
      </PageFrame>
    );
  }

  return (
    <PageFrame
      eyebrow="Settings"
      title="User Assignments"
      help="Assign users to roles and configure capability overrides"
    >
      {status && <StatusLine tone={statusTone}>{status}</StatusLine>}

      <PageCard>
        <div className="space-y-6">
          {/* User Selector */}
          <div>
            <AppSelectNative
              label="Select User"
              value={selectedUserId}
              onChange={(e) => handleSelectUser(e.target.value)}
            >
              <option value="">Choose a user...</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.firstName} {user.lastName} ({user.email})
                </option>
              ))}
            </AppSelectNative>
          </div>

          {selectedUser && (
            <>
              {/* Current Policy Display */}
              <div className="rounded border border-rule-soft bg-surface-2 p-4">
                <h3 className="mb-3 font-semibold">Current Policy</h3>
                <p className="text-sm">
                  <span className="font-semibold">Role:</span> {selectedUser.role.name}
                </p>
                <p className="text-xs text-ink-softer mt-1">
                  Last assigned: {new Date(selectedUser.id).toLocaleDateString()}
                </p>
              </div>

              {/* Base Role Selector */}
              <div>
                <label className="block text-sm font-semibold mb-3">Base Role</label>
                <div className="space-y-2">
                  {roles.map((role) => (
                    <label
                      key={role.id}
                      className="flex items-center gap-3 cursor-pointer p-3 rounded border border-rule-soft hover:bg-surface-2 transition-colors"
                    >
                      <input
                        type="radio"
                        name="baseRole"
                        value={role.name.toLowerCase()}
                        checked={baseRole === role.name.toLowerCase()}
                        onChange={(e) => setBaseRole(e.target.value)}
                        className="w-4 h-4"
                      />
                      <div>
                        <p className="font-semibold">{role.name}</p>
                        <p className="text-xs text-ink-softer">{role.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Grant Extra Capabilities */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Grant Extra Capabilities</h3>
                  <Button size="sm" variant="outline" onClick={addGrantRow}>
                    + Add
                  </Button>
                </div>
                <div className="space-y-2 overflow-x-auto">
                  {grantExtra.length === 0 ? (
                    <p className="text-sm text-ink-softer">
                      No extra capabilities granted
                    </p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-rule-soft">
                          <th className="text-left px-2 py-2">Action</th>
                          <th className="text-left px-2 py-2">Resource</th>
                          <th className="text-left px-2 py-2">Scope</th>
                          <th className="text-right px-2 py-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grantExtra.map((cap, i) => (
                          <tr key={i} className="border-b border-rule-soft">
                            <td className="px-2 py-2">
                              <select
                                value={cap.action}
                                onChange={(e) =>
                                  updateGrantRow(i, "action", e.target.value)
                                }
                                className="w-full rounded border border-rule-soft px-2 py-1"
                              >
                                {ACTIONS.map((a) => (
                                  <option key={a} value={a}>
                                    {a}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-2">
                              <select
                                value={cap.resource}
                                onChange={(e) =>
                                  updateGrantRow(i, "resource", e.target.value)
                                }
                                className="w-full rounded border border-rule-soft px-2 py-1"
                              >
                                {RESOURCES.map((r) => (
                                  <option key={r} value={r}>
                                    {r}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-2">
                              <select
                                value={cap.scope}
                                onChange={(e) =>
                                  updateGrantRow(i, "scope", e.target.value)
                                }
                                className="w-full rounded border border-rule-soft px-2 py-1"
                              >
                                {SCOPES.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="text-right px-2 py-2">
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => removeGrantRow(i)}
                              >
                                Remove
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Revoke Capabilities */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Revoke Capabilities</h3>
                  <Button size="sm" variant="outline" onClick={addRevokeRow}>
                    + Add
                  </Button>
                </div>
                <div className="space-y-2 overflow-x-auto">
                  {revokeCapability.length === 0 ? (
                    <p className="text-sm text-ink-softer">No capabilities revoked</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-rule-soft">
                          <th className="text-left px-2 py-2">Action</th>
                          <th className="text-left px-2 py-2">Resource</th>
                          <th className="text-left px-2 py-2">Scope</th>
                          <th className="text-right px-2 py-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {revokeCapability.map((cap, i) => (
                          <tr key={i} className="border-b border-rule-soft">
                            <td className="px-2 py-2">
                              <select
                                value={cap.action}
                                onChange={(e) =>
                                  updateRevokeRow(i, "action", e.target.value)
                                }
                                className="w-full rounded border border-rule-soft px-2 py-1"
                              >
                                {ACTIONS.map((a) => (
                                  <option key={a} value={a}>
                                    {a}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-2">
                              <select
                                value={cap.resource}
                                onChange={(e) =>
                                  updateRevokeRow(i, "resource", e.target.value)
                                }
                                className="w-full rounded border border-rule-soft px-2 py-1"
                              >
                                {RESOURCES.map((r) => (
                                  <option key={r} value={r}>
                                    {r}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-2">
                              <select
                                value={cap.scope}
                                onChange={(e) =>
                                  updateRevokeRow(i, "scope", e.target.value)
                                }
                                className="w-full rounded border border-rule-soft px-2 py-1"
                              >
                                {SCOPES.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="text-right px-2 py-2">
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => removeRevokeRow(i)}
                              >
                                Remove
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Save Button */}
              <div className="flex gap-2">
                <Button onClick={handleSave}>Save Changes</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedUserId("");
                    setSelectedUser(null);
                  }}
                >
                  Clear
                </Button>
              </div>
            </>
          )}
        </div>
      </PageCard>
    </PageFrame>
  );
}
