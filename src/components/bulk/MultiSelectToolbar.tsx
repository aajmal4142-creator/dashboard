"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Trash2, Mail, Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type MultiSelectToolbarProps = {
  selectedCount: number;
  totalCount: number;
  onSelectAll: (checked: boolean) => void;
  onClearSelection: () => void;
  onBulkAction: (action: string, itemIds: string[]) => Promise<void>;
  selectedIds: string[];
  resourceType: "suppliers" | "datapoints" | "users";
};

export function MultiSelectToolbar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onBulkAction,
  selectedIds,
  resourceType,
}: MultiSelectToolbarProps) {
  const [loading, setLoading] = useState(false);

  const handleAction = async (action: string) => {
    if (selectedIds.length === 0) {
      toast.error("No items selected");
      return;
    }

    setLoading(true);
    try {
      await onBulkAction(action, selectedIds);
      toast.success(`${action} completed for ${selectedIds.length} items`);
      onClearSelection();
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to ${action}`;
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-4 border-b border-rule bg-accent-quiet px-4 py-3">
      <Checkbox
        checked={
          selectedCount > 0 && selectedCount < totalCount
            ? "indeterminate"
            : selectedCount === totalCount && selectedCount > 0
        }
        onCheckedChange={onSelectAll}
      />
      <span className="text-sm font-medium text-ink">
        {selectedCount > 0
          ? `${selectedCount} selected`
          : `Select items (${totalCount} total)`}
      </span>

      {selectedCount > 0 ? (
        <>
          <div className="flex-1" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={loading}>
                Actions <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {resourceType === "suppliers" ? (
                <>
                  <DropdownMenuItem onClick={() => void handleAction("email-reminder")}>
                    <Mail className="mr-2 h-4 w-4" /> Send reminder email
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void handleAction("update-status")}>
                    Update status
                  </DropdownMenuItem>
                </>
              ) : null}
              <DropdownMenuItem onClick={() => void handleAction("export")}>
                <Download className="mr-2 h-4 w-4" /> Export
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => void handleAction("delete")}
                className="text-rust"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="sm" onClick={onClearSelection}>
            Clear
          </Button>
        </>
      ) : null}
    </div>
  );
}
