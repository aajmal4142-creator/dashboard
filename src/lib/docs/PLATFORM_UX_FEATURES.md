# Sprint 7: Platform & UX Features

## Overview

Sprint 7 implements 4 major platform & UX features to enhance team collaboration, permissions management, and administrative capabilities.

## Features Implemented

### 1. Advanced Permission System (Custom Roles) - UX-001

**Status**: ✅ Implemented

#### Components

- `RoleBuilder` - React component for building custom roles with capability matrix
- API Routes: `/api/app/roles/*`

#### Database Collection

- `CustomRoles` - Stores custom role definitions with permissions and scopes

#### Features

- **Role Builder UI**: Interactive capability matrix for defining permissions
- **Capability Matrix**: Action × Resource grid for granular control
- **Role Templates**: Predefined role templates for common scenarios
- **Role Inheritance**: Support for role hierarchy (inheritsFrom field)
- **Bulk User Assignment**: Assign roles to multiple users at once
- **Audit Trail**: Role changes are logged in AuditLogs

#### Usage

```typescript
import { useCustomRoles } from "@/lib/hooks/useCustomRoles";

function MyComponent() {
  const { roles, loadRoles, createRole, deleteRole } = useCustomRoles();

  // Load roles
  useEffect(() => {
    loadRoles(false); // false = custom roles, true = templates
  }, [loadRoles]);

  // Create a role
  const handleCreate = async () => {
    await createRole(
      "ESG Analyst",
      "Can view and edit ESG data",
      {
        read: ["suppliers", "datapoints", "reports"],
        write: ["datapoints"],
        approve: ["reports"],
      },
      {
        suppliers: "team",
        datapoints: "own",
        reports: "organisation",
      },
    );
  };

  // Assign role to multiple users
  const handleBulkAssign = async (roleId: string, userIds: string[]) => {
    await bulkAssignRole(roleId, userIds);
  };
}
```

#### API Endpoints

- `GET /api/app/roles` - List custom roles
- `POST /api/app/roles` - Create role
- `GET /api/app/roles/[id]` - Get role details
- `PATCH /api/app/roles/[id]` - Update role
- `DELETE /api/app/roles/[id]` - Delete role
- `POST /api/app/roles/bulk-assign` - Assign role to multiple users

---

### 2. Bulk Operations & Multi-Select - UX-002

**Status**: ✅ Implemented

#### Components

- `MultiSelectToolbar` - Toolbar for bulk actions on selected items
- `SelectableTable` - Table component with multi-select support
- API Routes: `/api/app/bulk-operations/*`

#### Database Collection

- `BulkOperations` - Records of all bulk operations for audit trail and undo

#### Features

- **Multi-select Checkboxes**: Select individual items or all at once
- **Bulk Action Menu**: Context menu for bulk operations
- **Batch Operations**: Handle 100+ items efficiently
- **Undo Capability**: Revert bulk operations up to 30 days
- **Progress Tracking**: Monitor bulk operation progress
- **Email Reminders**: Send bulk emails to suppliers

#### Usage

```typescript
import { SelectableTable } from "@/components/bulk/SelectableTable";
import { useBulkOperations } from "@/lib/hooks/useBulkOperations";

function SuppliersPage() {
  const { createBulkOp, undoOperation } = useBulkOperations();

  const handleBulkAction = async (action: string, itemIds: string[]) => {
    const op = await createBulkOp(action, "suppliers", itemIds, {
      status: "pending", // for update-status action
    });

    // Poll for completion
    setInterval(() => {
      // Check operation status
    }, 2000);
  };

  return (
    <SelectableTable
      items={suppliers}
      columns={[
        { key: "name", label: "Name" },
        { key: "status", label: "Status" },
      ]}
      resourceType="suppliers"
      onBulkAction={handleBulkAction}
    />
  );
}
```

#### API Endpoints

- `GET /api/app/bulk-operations` - List bulk operations
- `POST /api/app/bulk-operations` - Create operation
- `GET /api/app/bulk-operations/[id]` - Get operation status
- `PATCH /api/app/bulk-operations/[id]` - Update operation
- `POST /api/app/bulk-operations/[id]/undo` - Undo operation

---

### 3. Saved Filters & Custom Views - UX-003

**Status**: ✅ Implemented

#### Components

- `SavedFiltersPanel` - Panel for managing saved filters
- API Routes: `/api/app/saved-filters/*`

#### Database Collection

- `SavedFilters` - Stores saved filter configurations per user and resource type

#### Features

- **Save Filter Combinations**: Store complex filter logic
- **Named Views**: Organize filters with names and descriptions
- **Share Views**: Share saved filters with team or specific users
- **Default Views**: Set default view per resource type per user
- **Quick Filters**: Common filter templates for faster access

#### Usage

```typescript
import { SavedFiltersPanel } from "@/components/filters/SavedFiltersPanel";
import { useSavedFilters } from "@/lib/hooks/useSavedFilters";

function DatapointsPage() {
  const { saveFilter, loadFilters, setDefaultFilter } = useSavedFilters();

  // Load filters on mount
  useEffect(() => {
    loadFilters("datapoints");
  }, [loadFilters]);

  // Save current filter
  const handleSaveFilter = async (name: string) => {
    await saveFilter(
      name,
      "My custom view",
      "datapoints",
      {
        status: ["pending", "approved"],
        priority: ["high"],
      },
      { field: "createdAt", order: "desc" },
      true // set as default
    );
  };

  // Apply filter
  const handleSelectFilter = (filter) => {
    applyFilterToUI(filter.filterConditions);
  };

  return (
    <SavedFiltersPanel
      resourceType="datapoints"
      onFilterSelect={handleSelectFilter}
      onFilterSave={handleSaveFilter}
    />
  );
}
```

#### API Endpoints

- `GET /api/app/saved-filters` - List filters for resource type
- `POST /api/app/saved-filters` - Create filter
- `GET /api/app/saved-filters/[id]` - Get filter details
- `PATCH /api/app/saved-filters/[id]` - Update filter (set default, share, etc.)
- `DELETE /api/app/saved-filters/[id]` - Delete filter

---

### 4. Audit Log Search & Export - UX-004

**Status**: ✅ Implemented

#### Components

- `AuditLogSearch` - Advanced search interface for audit logs
- API Routes: `/api/app/audit-logs/search`, `/api/app/audit-logs/export`

#### Database Collection

- Uses existing `AuditLogs` collection

#### Features

- **Full-text Search**: Search across action, entity type, and ID
- **Advanced Filters**: By user, action, resource, time range
- **Export Options**: CSV and JSON formats
- **Performance**: Optimized for 10K+ log entries
- **Pagination**: Limit and offset support

#### Usage

```typescript
import { AuditLogSearch } from "@/components/audit/AuditLogSearch";

function CompliancePage() {
  const [logs, setLogs] = useState([]);

  const handleLogsLoad = (loadedLogs) => {
    setLogs(loadedLogs);
    // Generate compliance report from logs
  };

  return (
    <AuditLogSearch onLogsLoad={handleLogsLoad} />
  );
}
```

#### API Endpoints

- `GET /api/app/audit-logs/search` - Search logs with filters
  - Query params: `q`, `action`, `entityType`, `userId`, `startDate`, `endDate`, `limit`, `offset`
- `GET /api/app/audit-logs/export` - Export logs
  - Query params: same as search + `format` (csv|json)

---

## Database Schema

### CustomRoles

```typescript
{
  organisation: relationship;
  name: text;
  description: textarea;
  isTemplate: boolean;
  permissions: json; // { action: [resources] }
  resourceScopes: json; // { resource: scope }
  inheritsFrom: relationship(optional);
  memberCount: number;
  createdAt: date;
  updatedAt: date;
}
```

### SavedFilters

```typescript
{
  organisation: relationship
  owner: relationship (user)
  name: text
  description: textarea
  resourceType: select
  filterConditions: json
  sortConfig: json
  isDefault: boolean
  isSharedWithTeam: boolean
  sharedWith: relationship[] (users)
  createdAt: date
  updatedAt: date
}
```

### BulkOperations

```typescript
{
  organisation: relationship;
  actor: relationship(user);
  operationType: select;
  resourceType: select;
  itemIds: json; // string[]
  itemCount: number;
  changes: json;
  status: select(pending | processing | completed | failed);
  progressPercent: number;
  errorMessage: textarea;
  beforeSnapshot: json; // for undo
  canUndo: boolean;
  undoneAt: date;
  createdAt: date;
  updatedAt: date;
}
```

---

## Integration Examples

### Example 1: Multi-Select in Suppliers List

```typescript
import { SelectableTable } from "@/components/bulk/SelectableTable";

export function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);

  return (
    <SelectableTable
      items={suppliers}
      columns={[
        { key: "name", label: "Supplier Name" },
        { key: "status", label: "Status" },
        { key: "complianceScore", label: "Compliance", render: (v) => `${v}%` },
      ]}
      resourceType="suppliers"
      onItemClick={(supplier) => navigateTo(`/suppliers/${supplier.id}`)}
      onBulkAction={async (action, ids) => {
        if (action === "email-reminder") {
          await fetch("/api/app/suppliers/reminders", {
            method: "POST",
            body: JSON.stringify({ supplierIds: ids }),
          });
        }
      }}
    />
  );
}
```

### Example 2: Role-Based Filtering

```typescript
// In settings or admin page
import { RoleBuilder } from "@/components/roles/RoleBuilder";

export function RoleManagementPage() {
  return (
    <RoleBuilder
      onSave={async (role) => {
        // Role saved to database
        // Now assign to users
      }}
    />
  );
}
```

### Example 3: Audit Compliance Report

```typescript
import { AuditLogSearch } from "@/components/audit/AuditLogSearch";

export function ComplianceReportPage() {
  return (
    <AuditLogSearch
      onLogsLoad={(logs) => {
        // Process logs for compliance report
        const reportData = generateComplianceReport(logs);
        exportReport(reportData);
      }}
    />
  );
}
```

---

## Permissions

### Role-Based Access

- **Read Custom Roles**: Admins of the organisation
- **Create/Update/Delete Roles**: Admins only
- **Bulk Assign Roles**: Admins only
- **View Audit Logs**: Admins only
- **Create/Update Saved Filters**: All authenticated users
- **Delete Filters**: Filter owner only
- **Create Bulk Operations**: Contributors+ only
- **Undo Bulk Operations**: Operation initiator only

### Access Control

All API endpoints check permissions using `requirePermission()` helper:

```typescript
const allowed = await requirePermission(
  userId,
  organisationId,
  action, // read|create|update|delete
  resource, // custom-roles|saved-filters|bulk-operations
  targetId,
);
```

---

## Performance Considerations

1. **Bulk Operations**: Process items asynchronously to prevent timeouts
2. **Audit Log Export**: Limited to 10K records to avoid memory issues
3. **Saved Filters**: Indexed by owner + resourceType for fast queries
4. **Custom Roles**: Cached in memory for permission checks
5. **Multi-Select**: Client-side selection to avoid server overload

---

## Testing

### Unit Tests Needed

- Role permission matrix validation
- Multi-select state management
- Filter condition serialization
- Audit log export format conversion

### Integration Tests

- Bulk operation undo functionality
- Role assignment with audit trail
- Filter sharing between users
- Audit log search with complex queries

---

## Future Enhancements

1. **Role Versioning**: Track role permission changes over time
2. **Filter Analytics**: Show which filters are used most
3. **Bulk Operation Scheduling**: Schedule bulk operations for off-peak hours
4. **Audit Log Retention**: Automatic cleanup of old logs
5. **Custom Views Dashboard**: Homepage with personalized quick access

---

## Migration Guide

If upgrading from a previous version:

1. Add new collections to payload config
2. Run payload migrations to create indexes
3. Users need to re-save their custom filters
4. No breaking changes to existing APIs

---

## Support & Documentation

- API Documentation: See inline JSDoc comments in API route files
- Component Storybook: Run `npm run storybook` to view components
- Examples: See `PLATFORM_UX_FEATURES.md` for usage examples
- Issues: Report to GitHub issues with `platform-ux` label
