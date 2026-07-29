export function createSelectionMap(ids: string[]): Map<string, boolean> {
  const map = new Map<string, boolean>();
  ids.forEach((id) => map.set(id, true));
  return map;
}

export function isAllSelected(total: number, selected: Map<string, boolean>): boolean {
  return selected.size === total && total > 0;
}

export function isPartiallySelected(selected: Map<string, boolean>): boolean {
  return selected.size > 0 && selected.size < Array.from(selected.values()).length;
}

export function toggleSelection(
  id: string,
  selected: Map<string, boolean>,
): Map<string, boolean> {
  const newMap = new Map(selected);
  if (newMap.has(id)) {
    newMap.delete(id);
  } else {
    newMap.set(id, true);
  }
  return newMap;
}

export function selectAll(ids: string[]): Map<string, boolean> {
  return createSelectionMap(ids);
}

export function selectNone(): Map<string, boolean> {
  return new Map();
}

export function getSelectedIds(selected: Map<string, boolean>): string[] {
  return Array.from(selected.keys());
}

export function invertSelection(
  allIds: string[],
  selected: Map<string, boolean>,
): Map<string, boolean> {
  const newMap = new Map<string, boolean>();
  allIds.forEach((id) => {
    if (!selected.has(id)) {
      newMap.set(id, true);
    }
  });
  return newMap;
}
