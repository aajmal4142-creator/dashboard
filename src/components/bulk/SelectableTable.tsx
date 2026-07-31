"use client";

import { useState, useCallback } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { MultiSelectToolbar } from "./MultiSelectToolbar";
import {
  selectAll,
  selectNone,
  toggleSelection,
  getSelectedIds,
} from "@/lib/utils/multiSelect";
import { useBulkOperations } from "@/lib/hooks/useBulkOperations";

type TableItem = {
  id: string;
  [key: string]: unknown;
};

type SelectableTableProps = {
  items: TableItem[];
  columns: Array<{
    key: string;
    label: string;
    render?: (value: unknown, item: TableItem) => React.ReactNode;
  }>;
  resourceType: "suppliers" | "datapoints" | "users";
  onItemClick?: (item: TableItem) => void;
  onBulkAction?: (action: string, itemIds: string[], items: TableItem[]) => Promise<void>;
  onOperationComplete?: () => void;
  /** When false, selection UI is shown without bulk action menu. */
  enableBulkActions?: boolean;
};

export function SelectableTable({
  items,
  columns,
  resourceType,
  onItemClick,
  onBulkAction,
  onOperationComplete,
  enableBulkActions = true,
}: SelectableTableProps) {
  const [selection, setSelection] = useState(new Map<string, boolean>());
  const { createBulkOp } = useBulkOperations();
  const selectedIds = getSelectedIds(selection);

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelection(selectAll(items.map((i) => i.id)));
      } else {
        setSelection(selectNone());
      }
    },
    [items],
  );

  const handleToggleItem = useCallback((id: string) => {
    setSelection((prev) => toggleSelection(id, prev));
  }, []);

  const handleBulkAction = async (action: string, itemIds: string[]) => {
    if (!enableBulkActions) {
      throw new Error("Bulk actions are not available");
    }
    const selectedItems = items.filter((item) => itemIds.includes(item.id));
    try {
      if (onBulkAction) {
        await onBulkAction(action, itemIds, selectedItems);
      } else {
        const changes = action === "update-status" ? { requestStatus: "pending" } : {};
        const op = await createBulkOp(
          action,
          resourceType,
          itemIds,
          changes,
          selectedItems,
        );
        if (!op) throw new Error("Bulk operation failed");
      }
      setSelection(selectNone());
      onOperationComplete?.();
    } catch (error) {
      throw error instanceof Error ? error : new Error("Bulk action failed");
    }
  };

  return (
    <div className="overflow-hidden rounded-md border border-rule bg-surface-1">
      {enableBulkActions ? (
        <MultiSelectToolbar
          selectedCount={selectedIds.length}
          totalCount={items.length}
          onSelectAll={handleSelectAll}
          onClearSelection={() => setSelection(selectNone())}
          onBulkAction={handleBulkAction}
          selectedIds={selectedIds}
          resourceType={resourceType}
        />
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[12px]">
          <thead>
            <tr className="border-b-2 border-rule-strong">
              {enableBulkActions ? (
                <th className="w-12 px-4 py-2.5">
                  <Checkbox
                    checked={
                      selectedIds.length > 0 && selectedIds.length < items.length
                        ? "indeterminate"
                        : selectedIds.length === items.length && items.length > 0
                    }
                    onCheckedChange={handleSelectAll}
                  />
                </th>
              ) : null}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="cursor-pointer border-b border-rule transition-colors last:border-b-0 hover:bg-surface-2"
                onClick={() => onItemClick?.(item)}
              >
                {enableBulkActions ? (
                  <td className="w-12 px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selection.has(item.id)}
                      onCheckedChange={() => handleToggleItem(item.id)}
                    />
                  </td>
                ) : null}
                {columns.map((col) => (
                  <td
                    key={`${item.id}-${col.key}`}
                    className="px-4 py-2.5 align-top text-ink"
                  >
                    {col.render
                      ? col.render(item[col.key], item)
                      : String(item[col.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {items.length === 0 ? (
        <div className="p-8 text-center text-[12px] text-ink-muted">
          No items to display
        </div>
      ) : null}
    </div>
  );
}
