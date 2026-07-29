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

interface SelectableTableProps {
  items: Array<{ id: string; [key: string]: unknown }>;
  columns: Array<{
    key: string;
    label: string;
    render?: (value: unknown) => React.ReactNode;
  }>;
  resourceType: "suppliers" | "datapoints" | "users";
  onItemClick?: (item: { id: string; [key: string]: unknown }) => void;
  onBulkAction?: (action: string, itemIds: string[]) => Promise<void>;
}

export function SelectableTable({
  items,
  columns,
  resourceType,
  onItemClick,
  onBulkAction,
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
    try {
      if (onBulkAction) {
        await onBulkAction(action, itemIds);
      } else {
        await createBulkOp(action, resourceType, itemIds, {});
      }
      setSelection(selectNone());
    } catch (error) {
      console.error("Bulk action failed:", error);
      throw error;
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <MultiSelectToolbar
        selectedCount={selectedIds.length}
        totalCount={items.length}
        onSelectAll={handleSelectAll}
        onClearSelection={() => setSelection(selectNone())}
        onBulkAction={handleBulkAction}
        selectedIds={selectedIds}
        resourceType={resourceType}
      />

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="w-12 px-4 py-3">
                <Checkbox
                  checked={
                    selectedIds.length > 0 && selectedIds.length < items.length
                      ? "indeterminate"
                      : selectedIds.length === items.length && items.length > 0
                  }
                  onCheckedChange={handleSelectAll}
                />
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-sm font-medium text-gray-700"
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
                className="border-b hover:bg-gray-50 cursor-pointer"
                onClick={() => !selection.has(item.id) && onItemClick?.(item)}
              >
                <td className="w-12 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selection.has(item.id)}
                    onCheckedChange={() => handleToggleItem(item.id)}
                  />
                </td>
                {columns.map((col) => (
                  <td key={`${item.id}-${col.key}`} className="px-4 py-3 text-sm">
                    {col.render
                      ? col.render((item as Record<string, unknown>)[col.key])
                      : String((item as Record<string, unknown>)[col.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {items.length === 0 && (
        <div className="p-8 text-center text-gray-500">No items to display</div>
      )}
    </div>
  );
}
