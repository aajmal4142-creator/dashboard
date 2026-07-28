"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PageFrame, PageCard } from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppField } from "@/components/ui/AppField";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { PolicyRole, Capability } from "@/lib/policy/types";

const ACTIONS = ["view", "create", "edit", "delete", "approve", "export"];
const RESOURCES = ["datapoint", "report", "supplier", "evidence", "audit", "policies"];
const SCOPES = ["own", "team", "organisation", "all"];

export default function RolesPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<PolicyRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<PolicyRole | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    capabilities: Capability[];
  }>({
    name: "",
    description: "",
    capabilities: [],
  });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRoles() {
      try {
        setLoading(true);
        const res = await fetch("/api/app/policies/roles");

        if (res.status === 403) {
          toast.error("Admin access required");
          router.push("/");
          return;
        }

        if (!res.ok) throw new Error("Failed to fetch roles");

        const data = (await res.json()) as PolicyRole[];
        setRoles(data);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load roles");
      } finally {
        setLoading(false);
      }
    }

    void fetchRoles();
  }, [router]);

  async function fetchRoles() {
    try {
      setLoading(true);
      const res = await fetch("/api/app/policies/roles");

      if (res.status === 403) {
        toast.error("Admin access required");
        router.push("/");
        return;
      }

      if (!res.ok) throw new Error("Failed to fetch roles");

      const data = (await res.json()) as PolicyRole[];
      setRoles(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load roles");
    } finally {
      setLoading(false);
    }
  }

  const filteredRoles = useMemo(() => {
    if (!search) return roles;
    const q = search.toLowerCase();
    return roles.filter(
      (r) => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q),
    );
  }, [roles, search]);

  function openCreateModal() {
    setEditingRole(null);
    setFormData({
      name: "",
      description: "",
      capabilities: [],
    });
    setShowModal(true);
  }

  function openEditModal(role: PolicyRole) {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description,
      capabilities: role.defaultCapabilities,
    });
    setShowModal(true);
  }

  function toggleCapability(action: string, resource: string, scope: string) {
    const caps = [...formData.capabilities];
    const exists = caps.find(
      (c) => c.action === action && c.resource === resource && c.scope === scope,
    );

    if (exists) {
      setFormData({
        ...formData,
        capabilities: caps.filter(
          (c) => !(c.action === action && c.resource === resource && c.scope === scope),
        ),
      });
    } else {
      caps.push({
        action: action as Capability["action"],
        resource,
        scope: scope as Capability["scope"],
      });
      setFormData({ ...formData, capabilities: caps });
    }
  }

  async function handleSave() {
    if (!formData.name.trim() || !formData.description.trim()) {
      toast.error("Name and description are required");
      return;
    }

    try {
      if (editingRole) {
        const res = await fetch(`/api/app/policies/roles/${editingRole.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description,
            capabilities: formData.capabilities,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to update role");
        }

        toast.success("Role updated");
      } else {
        const res = await fetch("/api/app/policies/roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description,
            capabilities: formData.capabilities,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to create role");
        }

        toast.success("Role created");
      }

      setShowModal(false);
      await fetchRoles();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save role");
    }
  }

  async function handleDelete(roleId: string) {
    try {
      const res = await fetch(`/api/app/policies/roles/${roleId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete role");
      }

      toast.success("Role deleted");
      setDeleteConfirm(null);
      await fetchRoles();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete role");
    }
  }

  if (loading) {
    return (
      <PageFrame eyebrow="Settings" title="Policy Roles">
        <PageCard>
          <div className="py-8 text-center">Loading...</div>
        </PageCard>
      </PageFrame>
    );
  }

  return (
    <PageFrame
      eyebrow="Settings"
      title="Policy Roles"
      help="Create and manage organization roles. System roles cannot be modified."
      actions={<Button onClick={openCreateModal}>+ Create Role</Button>}
    >
      <PageCard>
        <div className="mb-6">
          <Input
            type="search"
            placeholder="Search roles by name or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-rule-strong">
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide">
                  Name
                </th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide">
                  Description
                </th>
                <th className="px-4 py-3 text-center font-semibold uppercase tracking-wide">
                  Capabilities
                </th>
                <th className="px-4 py-3 text-center font-semibold uppercase tracking-wide">
                  System
                </th>
                <th className="px-4 py-3 text-right font-semibold uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRoles.map((role) => (
                <tr
                  key={role.id}
                  className="border-b border-rule-soft transition-colors hover:bg-surface-2"
                >
                  <td className="px-4 py-3 font-semibold">{role.name}</td>
                  <td className="px-4 py-3 text-ink-softer">{role.description}</td>
                  <td className="px-4 py-3 text-center text-sm">
                    {role.defaultCapabilities.length}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {role.isSystem ? (
                      <span className="rounded bg-accent/10 px-2 py-1 text-xs font-semibold text-accent">
                        System
                      </span>
                    ) : (
                      <span className="text-xs text-ink-muted">Custom</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!role.isSystem && (
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(role)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteConfirm(role.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredRoles.length === 0 && (
          <div className="py-8 text-center text-ink-softer">No roles found</div>
        )}
      </PageCard>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRole ? "Edit Role" : "Create Role"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <AppField
              label="Role Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Finance Auditor"
            />

            <div>
              <label className="block text-sm font-semibold mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Description of this role's purpose"
                className="w-full rounded border border-rule-soft px-3 py-2 text-sm"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-4">
                Capabilities Grid
              </label>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {RESOURCES.map((resource) => (
                  <div
                    key={resource}
                    className="space-y-2 rounded border border-rule-soft p-3"
                  >
                    <p className="font-semibold text-sm capitalize">{resource}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {ACTIONS.map((action) => (
                        <div key={`${action}:${resource}`}>
                          {SCOPES.map((scope) => {
                            const selected = formData.capabilities.some(
                              (c) =>
                                c.action === action &&
                                c.resource === resource &&
                                c.scope === scope,
                            );
                            return (
                              <label
                                key={`${action}:${resource}:${scope}`}
                                className="flex items-center gap-2 text-xs cursor-pointer py-1"
                              >
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() =>
                                    toggleCapability(action, resource, scope)
                                  }
                                  className="w-4 h-4"
                                />
                                <span>
                                  {action} ({scope[0]})
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save Role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Role</DialogTitle>
            </DialogHeader>
            <p>
              Are you sure you want to delete this role? This action cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => handleDelete(deleteConfirm)}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </PageFrame>
  );
}
