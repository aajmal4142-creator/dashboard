import { useState, useCallback } from "react";
import { toast } from "sonner";

interface SavedFilter {
  id: string;
  name: string;
  description?: string;
  resourceType: string;
  filterConditions: unknown;
  sortConfig?: unknown;
  isDefault: boolean;
  isSharedWithTeam: boolean;
  createdAt: string;
}

interface UseSavedFiltersReturn {
  filters: SavedFilter[];
  loading: boolean;
  loadFilters: (resourceType: string) => Promise<void>;
  saveFilter: (
    name: string,
    description: string,
    resourceType: string,
    filterConditions: unknown,
    sortConfig?: unknown,
    isDefault?: boolean,
    isSharedWithTeam?: boolean,
  ) => Promise<SavedFilter | null>;
  deleteFilter: (filterId: string) => Promise<boolean>;
  setDefaultFilter: (filterId: string) => Promise<boolean>;
  shareFilter: (filterId: string, shared: boolean) => Promise<boolean>;
}

export function useSavedFilters(): UseSavedFiltersReturn {
  const [filters, setFilters] = useState<SavedFilter[]>([]);
  const [loading, setLoading] = useState(false);

  const loadFilters = useCallback(async (resourceType: string) => {
    setLoading(true);
    try {
      const url = new URL("/api/app/saved-filters", window.location.origin);
      url.searchParams.append("resourceType", resourceType);

      const response = await fetch(url);
      const data = await response.json();
      setFilters(data.filters || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load filters";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveFilter = useCallback(
    async (
      name: string,
      description: string,
      resourceType: string,
      filterConditions: unknown,
      sortConfig?: unknown,
      isDefault?: boolean,
      isSharedWithTeam?: boolean,
    ): Promise<SavedFilter | null> => {
      try {
        const response = await fetch("/api/app/saved-filters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description,
            resourceType,
            filterConditions,
            sortConfig,
            isDefault,
            isSharedWithTeam,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to save filter");
        }

        const data = await response.json();
        const filter = data.filter;

        if (isDefault) {
          setFilters((prev) =>
            prev.map((f) => ({
              ...f,
              isDefault:
                f.resourceType === resourceType ? f.id === filter.id : f.isDefault,
            })),
          );
        }

        setFilters((prev) => [filter, ...prev.filter((f) => f.id !== filter.id)]);
        toast.success("Filter saved");
        return filter;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to save filter";
        toast.error(message);
        return null;
      }
    },
    [],
  );

  const deleteFilter = useCallback(async (filterId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/app/saved-filters/${filterId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete filter");
      }

      setFilters((prev) => prev.filter((f) => f.id !== filterId));
      toast.success("Filter deleted");
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete filter";
      toast.error(message);
      return false;
    }
  }, []);

  const setDefaultFilter = useCallback(
    async (filterId: string): Promise<boolean> => {
      try {
        const filter = filters.find((f) => f.id === filterId);
        if (!filter) return false;

        const response = await fetch(`/api/app/saved-filters/${filterId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isDefault: true }),
        });

        if (!response.ok) {
          throw new Error("Failed to update filter");
        }

        setFilters((prev) =>
          prev.map((f) =>
            f.resourceType === filter.resourceType
              ? { ...f, isDefault: f.id === filterId }
              : f,
          ),
        );
        toast.success("Default filter updated");
        return true;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to update filter";
        toast.error(message);
        return false;
      }
    },
    [filters],
  );

  const shareFilter = useCallback(
    async (filterId: string, shared: boolean): Promise<boolean> => {
      try {
        const response = await fetch(`/api/app/saved-filters/${filterId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isSharedWithTeam: shared }),
        });

        if (!response.ok) {
          throw new Error("Failed to update filter");
        }

        setFilters((prev) =>
          prev.map((f) => (f.id === filterId ? { ...f, isSharedWithTeam: shared } : f)),
        );
        toast.success(shared ? "Filter shared with team" : "Filter unshared");
        return true;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to update filter";
        toast.error(message);
        return false;
      }
    },
    [],
  );

  return {
    filters,
    loading,
    loadFilters,
    saveFilter,
    deleteFilter,
    setDefaultFilter,
    shareFilter,
  };
}
