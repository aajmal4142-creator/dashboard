"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageFrame } from "@/components/shell/PageFrame";
import { RoleBuilder } from "@/components/roles/RoleBuilder";
import { useCustomRoles } from "@/lib/hooks/useCustomRoles";
import { Trash2, Edit2, Plus } from "lucide-react";

export default function RolesPage() {
  const { roles, loading, loadRoles, createRole, deleteRole } = useCustomRoles();
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingRole, setEditingRole] = useState<(typeof roles)[0] | null>(null);

  useEffect(() => {
    loadRoles(false);
  }, [loadRoles]);

  const handleSaveRole = async (roleData: {
    name: string;
    description?: string;
    permissions: Record<string, string[]>;
    resourceScopes: Record<string, string>;
  }) => {
    const success = await createRole(
      roleData.name,
      roleData.description || "",
      roleData.permissions,
      roleData.resourceScopes,
    );

    if (success) {
      setShowBuilder(false);
      setEditingRole(null);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm("Are you sure you want to delete this role?")) return;
    await deleteRole(roleId);
  };

  return (
    <PageFrame
      eyebrow="Admin"
      title="Custom Roles"
      help="Manage custom roles and permissions for your team"
    >
      <div className="space-y-6">
        {!showBuilder ? (
          <>
            <Button onClick={() => setShowBuilder(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Role
            </Button>

            <div className="grid gap-4">
              {loading ? (
                <p className="text-gray-500">Loading roles...</p>
              ) : roles.length === 0 ? (
                <p className="text-gray-500">No custom roles yet</p>
              ) : (
                roles.map((role) => (
                  <Card key={role.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold">{role.name}</h3>
                        {role.description && (
                          <p className="text-sm text-gray-600 mt-1">{role.description}</p>
                        )}
                        <div className="mt-2 text-xs text-gray-500">
                          {role.memberCount} members •{" "}
                          {Object.keys(role.permissions).length} permissions
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingRole(role)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteRole(role.id)}
                          className="text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={() => setShowBuilder(false)}>
              ← Back to Roles
            </Button>
            <RoleBuilder onSave={handleSaveRole} initialRole={editingRole} />
          </>
        )}
      </div>
    </PageFrame>
  );
}
