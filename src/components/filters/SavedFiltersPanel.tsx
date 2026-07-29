"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Star, Trash2, Share2 } from "lucide-react";
import { toast } from "sonner";

interface SavedFilter {
  id: string;
  name: string;
  description?: string;
  resourceType: string;
  isDefault: boolean;
  isSharedWithTeam: boolean;
  createdAt: string;
  owner: string;
}

interface SavedFiltersPanelProps {
  resourceType: string;
  onFilterSelect: (filter: SavedFilter) => void;
  onFilterSave?: (filterName: string, filterConditions: unknown) => void;
}

export function SavedFiltersPanel({
  resourceType,
  onFilterSelect,
  onFilterSave,
}: SavedFiltersPanelProps) {
  const [filters, setFilters] = useState<SavedFilter[]>([]);
  const [loading, setLoading] = useState(true);
  const [newFilterName, setNewFilterName] = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadFilters = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/app/saved-filters?resourceType=${resourceType}`,
        );
        const data = await response.json();
        if (!cancelled) {
          setFilters(data.filters || []);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load filters";
        toast.error(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadFilters();

    return () => {
      cancelled = true;
    };
  }, [resourceType]);

  const handleDelete = async (filterId: string) => {
    try {
      const response = await fetch(`/api/app/saved-filters/${filterId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete");

      setFilters(filters.filter((f) => f.id !== filterId));
      toast.success("Filter deleted");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete filter";
      toast.error(message);
    }
  };

  const handleSetDefault = async (filterId: string) => {
    try {
      await fetch(`/api/app/saved-filters/${filterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });

      const updated = filters.map((f) => ({
        ...f,
        isDefault: f.id === filterId,
      }));
      setFilters(updated);
      toast.success("Default filter updated");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update filter";
      toast.error(message);
    }
  };

  if (loading) {
    return <div className="p-4 text-sm text-gray-500">Loading filters...</div>;
  }

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Saved Views</h3>
          {onFilterSave && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowSaveForm(!showSaveForm)}
            >
              Save View
            </Button>
          )}
        </div>

        {showSaveForm && onFilterSave && (
          <div className="space-y-2 p-2 bg-gray-50 rounded">
            <Input
              placeholder="View name"
              value={newFilterName}
              onChange={(e) => setNewFilterName(e.target.value)}
              className="h-8 text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  onFilterSave(newFilterName, {});
                  setNewFilterName("");
                  setShowSaveForm(false);
                }}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowSaveForm(false);
                  setNewFilterName("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {filters.length === 0 ? (
            <p className="text-xs text-gray-500">No saved filters yet</p>
          ) : (
            filters.map((filter) => (
              <div
                key={filter.id}
                className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer group"
                onClick={() => onFilterSelect(filter)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{filter.name}</p>
                  {filter.description && (
                    <p className="text-xs text-gray-500 truncate">{filter.description}</p>
                  )}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                  {filter.isDefault ? (
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetDefault(filter.id);
                      }}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      <Star className="h-4 w-4 text-gray-400" />
                    </button>
                  )}
                  {filter.isSharedWithTeam && (
                    <Share2 className="h-4 w-4 text-blue-500" />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(filter.id);
                    }}
                    className="p-1 hover:bg-red-100 rounded"
                  >
                    <Trash2 className="h-4 w-4 text-gray-400" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}
