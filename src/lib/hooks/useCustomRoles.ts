import { useState, useCallback } from "react";
import { toast } from "sonner";

interface CustomRole {
  id: string;
  name: string;
  description?: string;
  isTemplate: boolean;
  permissions: Record<string, string[]>;
  resourceScopes: Record<string, string>;
  memberCount: number;
  createdAt: string;
}

interface UseCustomRolesReturn {
  roles: CustomRole[];
  loading: boolean;
  loadRoles: (isTemplate?: boolean) => Promise<void>;
  createRole: (
    name: string,
    description: string,
    permissions: Record<string, string[]>,
    resourceScopes: Record<string, string>,
  ) => Promise<CustomRole | null>;
  updateRole: (roleId: string, data: Partial<CustomRole>) => Promise<CustomRole | null>;
  deleteRole: (roleId: string) => Promise<boolean>;
  bulkAssignRole: (roleId: string, userIds: string[]) => Promise<boolean>;
}

export function useCustomRoles(): UseCustomRolesReturn {
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRoles = useCallback(async (isTemplate?: boolean) => {
    setLoading(true);
    try {
      const url = new URL("/api/app/roles", window.location.origin);
      if (isTemplate !== undefined)
        url.searchParams.append("isTemplate", String(isTemplate));

      const response = await fetch(url);
      const data = await response.json();
      setRoles(data.roles || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load roles";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createRole = useCallback(
    async (
      name: string,
      description: string,
      permissions: Record<string, string[]>,
      resourceScopes: Record<string, string>,
    ): Promise<CustomRole | null> => {
      try {
        const response = await fetch("/api/app/roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description,
            permissions,
            resourceScopes,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to create role");
        }

        const data = await response.json();
        const role = data.role;
        setRoles((prev) => [role, ...prev]);
        toast.success("Role created successfully");
        return role;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create role";
        toast.error(message);
        return null;
      }
    },
    [],
  );

  const updateRole = useCallback(
    async (roleId: string, data: Partial<CustomRole>): Promise<CustomRole | null> => {
      try {
        const response = await fetch(`/api/app/roles/${roleId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          throw new Error("Failed to update role");
        }

        const result = await response.json();
        const updated = result.role;
        setRoles((prev) => prev.map((r) => (r.id === roleId ? updated : r)));
        toast.success("Role updated");
        return updated;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update role";
        toast.error(message);
        return null;
      }
    },
    [],
  );

  const deleteRole = useCallback(async (roleId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/app/roles/${roleId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete role");
      }

      setRoles((prev) => prev.filter((r) => r.id !== roleId));
      toast.success("Role deleted");
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete role";
      toast.error(message);
      return false;
    }
  }, []);

  const bulkAssignRole = useCallback(
    async (roleId: string, userIds: string[]): Promise<boolean> => {
      try {
        const response = await fetch("/api/app/roles/bulk-assign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roleId, userIds }),
        });

        if (!response.ok) {
          throw new Error("Failed to assign role");
        }

        toast.success(`Role assigned to ${userIds.length} users`);
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to assign role";
        toast.error(message);
        return false;
      }
    },
    [],
  );

  return {
    roles,
    loading,
    loadRoles,
    createRole,
    updateRole,
    deleteRole,
    bulkAssignRole,
  };
}
