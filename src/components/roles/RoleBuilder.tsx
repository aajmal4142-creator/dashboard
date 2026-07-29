"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface RoleBuilderProps {
  onSave?: (role: RoleData) => void;
  initialRole?: RoleData | null;
}

interface RoleData {
  name: string;
  description?: string;
  permissions: Record<string, string[]>;
  resourceScopes: Record<string, string>;
}

const ACTIONS = ["read", "write", "delete", "approve", "export"];
const RESOURCES = [
  "suppliers",
  "datapoints",
  "reports",
  "users",
  "materiality",
  "obligations",
  "audit-logs",
];
const SCOPES = ["own", "team", "organisation"];

export function RoleBuilder({ onSave, initialRole }: RoleBuilderProps) {
  const [name, setName] = useState(initialRole?.name || "");
  const [description, setDescription] = useState(initialRole?.description || "");
  const [permissions, setPermissions] = useState<Record<string, string[]>>(
    initialRole?.permissions || {},
  );
  const [resourceScopes, setResourceScopes] = useState<Record<string, string>>(
    initialRole?.resourceScopes || {},
  );
  const [loading, setLoading] = useState(false);

  const togglePermission = (action: string, resource: string) => {
    setPermissions((prev) => {
      const actionPerms = prev[action] || [];
      const exists = actionPerms.includes(resource);
      return {
        ...prev,
        [action]: exists
          ? actionPerms.filter((r) => r !== resource)
          : [...actionPerms, resource],
      };
    });
  };

  const toggleScope = (resource: string, scope: string) => {
    setResourceScopes((prev) => ({
      ...prev,
      [resource]: prev[resource] === scope ? "" : scope,
    }));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Role name is required");
      return;
    }

    setLoading(true);
    try {
      const roleData = { name, description, permissions, resourceScopes };

      if (onSave) {
        onSave(roleData);
      } else {
        const response = await fetch("/api/app/roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(roleData),
        });

        if (!response.ok) {
          throw new Error("Failed to save role");
        }

        toast.success("Role created successfully");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save role";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Role Details</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Role Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., ESG Analyst"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this role for?"
              rows={3}
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold mb-4">Capability Matrix</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-2">Action</th>
                {RESOURCES.map((r) => (
                  <th key={r} className="text-center py-2 px-2">
                    {r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ACTIONS.map((action) => (
                <tr key={action} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-2 font-medium">{action}</td>
                  {RESOURCES.map((resource) => (
                    <td key={`${action}-${resource}`} className="text-center py-2 px-2">
                      <Checkbox
                        checked={(permissions[action] || []).includes(resource)}
                        onCheckedChange={() => togglePermission(action, resource)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold mb-4">Resource Scopes</h3>
        <div className="space-y-4">
          {RESOURCES.map((resource) => (
            <div key={resource}>
              <label className="text-sm font-medium block mb-2">{resource}</label>
              <div className="flex gap-2">
                {SCOPES.map((scope) => (
                  <Badge
                    key={scope}
                    variant={resourceScopes[resource] === scope ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleScope(resource, scope)}
                  >
                    {scope}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={loading} className="flex-1">
          {loading ? "Saving..." : "Save Role"}
        </Button>
      </div>
    </div>
  );
}
