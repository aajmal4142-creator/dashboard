# ABAC Access Control System Guide

## Overview

The Attribute-Based Access Control (ABAC) system provides flexible, role-based access control with per-user customization. Admins can assign predefined roles to users, then customize capabilities on a per-user basis.

## Architecture

### Key Concepts

- **Role**: A named collection of default capabilities (e.g., Admin, Contributor, Viewer)
- **Capability**: A permission to perform an action on a resource with a specific scope
- **UserPolicy**: Links a user to a role in an organisation, with optional custom capability overrides
- **PolicyEvaluation**: Audit log entry recording every access decision

### Actions & Resources

**Actions**:

- `view` - Read/view access
- `create` - Create new resource
- `edit` - Edit existing resource
- `delete` - Delete resource
- `approve` - Approve/verify resource
- `export` - Export data
- `manage-users` - Manage team members
- `manage-policies` - Manage policies and roles

**Resources**:

- `datapoint` - Emissions data points
- `report` - Compliance reports
- `organisation` - Organisation settings
- `user` - User/team member
- `policy` - Policy rules
- `compliance` - Compliance obligations

### Scopes

- `own` - User's own data only
- `team` - Data owned by user's team
- `organisation` - All organisation data
- `all` - All data (unrestricted)

## Default Roles

### 1. Admin

Full access to all resources.

**Key Capabilities**:

- View/Create/Edit/Delete/Approve all datapoints and reports
- Manage team members and policies
- Edit organisation settings

### 2. Contributor

Can create and edit data.

**Key Capabilities**:

- View all datapoints and reports
- Create datapoints
- Edit own datapoints
- Export reports

### 3. Viewer

Read-only access.

**Key Capabilities**:

- View all datapoints and reports
- Export reports
- View organisation settings

### 4. Consultant

Limited access for external consultants.

**Key Capabilities**:

- View team datapoints and reports
- Export team reports
- Limited visibility (team scope only)

## Usage Guide

### For Developers

#### 1. Protect API Routes

```typescript
import { requirePermission } from "@/lib/policy/protect";

export async function POST(request: Request) {
  const { userId, organisationId, datapointId } = await request.json();

  // Check permission
  const allowed = await requirePermission(
    userId,
    organisationId,
    "edit",
    "datapoint",
    datapointId,
    "organisation",
  );

  if (!allowed) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Proceed with operation...
}
```

#### 2. Get User Capabilities

```typescript
import { getUserCapabilities } from "@/lib/policy/protect";

const capabilities = await getUserCapabilities(userId, organisationId);

if (!capabilities) {
  console.log("User has no policy assigned");
  return;
}

console.log(capabilities.roleName); // "Admin", "Contributor", etc.
```

#### 3. Evaluate Policies Directly

```typescript
import { evaluatePolicy } from "@/lib/policy";

const result = evaluatePolicy(capabilities, "delete", "datapoint", "organisation");

if (result.decision === "allowed") {
  console.log(result.reason);
} else {
  console.error(result.reason);
}
```

### For Admins

#### Assigning Roles

1. Go to Admin Panel → Policies → Users
2. Select a user and organisation
3. Choose a default role (Admin, Contributor, Viewer, Consultant)
4. Click "Assign"

#### Customizing Capabilities

After assigning a role:

1. Click "Edit" on the user policy
2. Under "Custom Capabilities", add/remove specific permissions:
   - Click "Add Capability"
   - Select Action (view, create, edit, etc.)
   - Enter Resource (datapoint, report, etc.)
   - Select Scope (own, team, organisation, all)
   - Choose "Grant" or "Revoke"

#### Example: Contractor Access

1. Assign "Consultant" role
2. Add custom capability: `view:compliance` with scope `team`
3. Revoke: `edit:datapoint`

#### Viewing Audit Logs

1. Go to Admin Panel → Policies → Audit Logs
2. Filter by:
   - User
   - Organisation
   - Resource
   - Action
   - Decision (Allowed/Denied)

### API Endpoints

#### Evaluate Permission

```bash
POST /api/app/policies/evaluate
Content-Type: application/json

{
  "userId": "user-123",
  "organisationId": "org-456",
  "action": "edit",
  "resource": "datapoint",
  "resourceId": "dp-789",
  "scope": "organisation"
}
```

Response:

```json
{
  "decision": "allowed",
  "reason": "User role 'Contributor' can edit datapoint within organisation"
}
```

#### List Roles

```bash
GET /api/app/policies/roles
```

Response:

```json
[
  {
    "id": "role-1",
    "name": "Admin",
    "description": "Full access to all resources and settings",
    "defaultCapabilities": [...],
    "isSystem": true
  },
  ...
]
```

#### Get/Update User Policy

```bash
GET /api/app/policies/users/:userId/organisations/:organisationId
```

```bash
POST /api/app/policies/users
Content-Type: application/json

{
  "userId": "user-123",
  "organisationId": "org-456",
  "roleId": "role-admin",
  "customCapabilities": [
    {
      "action": "manage-policies",
      "resource": "policy",
      "scope": "organisation",
      "isGrant": false
    }
  ],
  "notes": "Admin except cannot manage policies"
}
```

## Audit Logging

Every policy evaluation is logged with:

- **userId**: Who performed the action
- **organisationId**: Organisation context
- **action**: What they tried to do
- **resource**: On what resource
- **resourceId**: Specific resource ID
- **decision**: Allowed or Denied
- **reason**: Why (useful for debugging)
- **userRole**: Their role at evaluation time
- **evaluatedAt**: When it happened
- **ip**: IP address (if available)

### Query Audit Logs

```bash
GET /api/app/policies/audit-logs?userId=user-123&organisationId=org-456
```

## Database Schema

### PolicyRoles Collection

```typescript
{
  id: string;
  name: string;
  description: string;
  defaultCapabilities: Capability[];
  isSystem: boolean; // System roles cannot be deleted
  createdAt: Date;
  updatedAt: Date;
}
```

### UserPolicies Collection

```typescript
{
  id: string;
  user: ObjectId; // Reference to users collection
  organisation: ObjectId; // Reference to organisations collection
  role: ObjectId; // Reference to policy-roles collection
  customCapabilities: Capability[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### PolicyEvaluations Collection (Audit Log)

```typescript
{
  id: string;
  userId: string;
  organisationId: string;
  action: string;
  resource: string;
  resourceId: string;
  decision: "allowed" | "denied";
  reason: string;
  userRole?: string;
  ip?: string;
  evaluatedAt: Date;
  // Indexed fields: userId, organisationId, action, resource, decision, evaluatedAt
}
```

## Best Practices

### 1. Always Log Policy Checks

Every access decision is logged automatically. Use the audit logs to:

- Debug permission issues
- Monitor security events
- Comply with audit requirements

### 2. Default to Deny

The system defaults to denying access if:

- User has no policy assigned
- Capability doesn't exist
- Scope is insufficient

### 3. Use Role Templates First

Most users should fit into one of the 4 default roles. Only customize capabilities if necessary.

### 4. Keep Custom Capabilities Minimal

Avoid creating complex custom policies. If many users need the same permissions, create a new role instead.

### 5. Audit High-Risk Actions

Always check permissions before:

- Deleting resources
- Approving data
- Exporting sensitive data
- Managing policies

## Performance Considerations

### Caching

Policy evaluations are not cached by default. To add caching:

```typescript
// Add Redis cache wrapper
const cacheKey = `policy:${userId}:${organisationId}`;
const cached = await redis.get(cacheKey);
if (cached) return cached;

const capabilities = await policyService.getUserCapabilities(userId, organisationId);
await redis.setex(cacheKey, 3600, JSON.stringify(capabilities)); // 1 hour TTL
return capabilities;
```

### Database Indexes

The system automatically creates indexes on:

- `user-policies`: user, organisation
- `policy-evaluations`: userId, organisationId, action, resource, decision, evaluatedAt

No additional indexes needed for typical usage.

### Audit Log Storage

Audit logs can grow quickly. Consider:

- Archive old logs (> 90 days) to cold storage
- Aggregate summaries for reporting
- Use MongoDB TTL indexes to auto-delete old entries

## Troubleshooting

### Permission Denied for Expected Action

1. Check user has a policy assigned:

   ```typescript
   const policy = await payload.find({
     collection: "user-policies",
     where: { user: { equals: userId } },
   });
   ```

2. Check audit logs for the specific action
3. Verify capability includes the resource and required scope
4. Check for custom revokes (isGrant: false)

### User Added to Organisation But No Access

New users need a policy assigned. Either:

1. Admin manually assigns a role via UI
2. App automatically assigns default role on invitation (recommended)

### Cascading Permissions

If you need "if user can see X, they can see Y":

- Model Y as a child resource with same scope
- Or add explicit capability check in logic

## Future Enhancements

Planned for later phases:

- Attribute-based conditions (e.g., "if department == HR")
- Time-based access (e.g., "can edit until deadline")
- Delegation (e.g., "manager can grant limited permissions")
- Group policies (e.g., "all dept leads get this role")

---

## Integration into API Routes

As of Day 2-3, ABAC checks have been integrated into 8 high-priority API routes. This section documents the integration patterns and provides examples.

### Integration Pattern

Every protected route follows this pattern:

```typescript
import { requirePermission } from "@/lib/policy/protect";
import { getCurrentContext } from "@/lib/auth";

export async function POST(request: Request) {
  const ctx = await getCurrentContext();

  // 1. Verify user is authenticated and has an active org
  if (!ctx.activeOrg || !ctx.user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 2. Parse and validate request body
  const body = await request.json();
  if (!body.resourceId) {
    return NextResponse.json({ error: "resourceId required" }, { status: 400 });
  }

  // 3. Check ABAC permission (this logs automatically)
  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "action", // e.g., "view", "create", "edit", "delete", "approve"
    "resource", // e.g., "datapoint", "report", "supplier"
    body.resourceId, // specific resource ID
    "organisation", // scope: "own" | "team" | "organisation" | "all"
  );

  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 4. Proceed with operation (audit already logged by requirePermission)
  const payload = await getPayload({ config });
  // ... perform operation ...

  return NextResponse.json({ ok: true });
}
```

### Integrated Routes (8 Total)

#### 1. Datapoints Approve

- **Route**: `POST /api/app/datapoints/approve`
- **Action**: `approve`
- **Resource**: `datapoint`
- **Scope**: `organisation` (approving is an org-level decision)
- **Required Capability**: Admin role (via `approve:datapoint:organisation`)

#### 2. Datapoints Assign

- **Route**: `POST /api/app/datapoints/assign`
- **Action**: `edit`
- **Resource**: `datapoint`
- **Scope**: `organisation`
- **Required Capability**: Contributor+ (can edit org datapoints)

#### 3. Reports List

- **Route**: `GET /api/app/reports`
- **Action**: `view`
- **Resource**: `report`
- **Scope**: `organisation`
- **Required Capability**: Viewer+ (can view org reports)

#### 4. Reports Create

- **Route**: `POST /api/app/reports`
- **Action**: `create`
- **Resource**: `report`
- **Scope**: `organisation`
- **Required Capability**: Admin role (via `create:report:organisation`)

#### 5. Suppliers List

- **Route**: `GET /api/app/suppliers`
- **Action**: `view`
- **Resource**: `supplier`
- **Scope**: `organisation`
- **Required Capability**: Viewer+ (can view org suppliers)

#### 6. Suppliers Create

- **Route**: `POST /api/app/suppliers`
- **Action**: `create`
- **Resource**: `supplier`
- **Scope**: `organisation`
- **Required Capability**: Contributor+ (can create org suppliers)

#### 7. Teammates List

- **Route**: `GET /api/app/teammates`
- **Action**: `view`
- **Resource**: `user`
- **Scope**: `organisation`
- **Required Capability**: Viewer+ (can view org team members)

#### 8. Audit Logs

- **Route**: `GET /api/app/audit-logs`
- **Action**: `view`
- **Resource**: `policy`
- **Scope**: `organisation`
- **Required Capability**: Admin role (via `view:policy:organisation`)

### Using Scope Detection

For routes where you need to distinguish between "own" and "organisation" scope:

```typescript
import { detectScopeCached } from "@/lib/policy/scope";

export async function POST(request: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) return 403;

  const body = await request.json();

  // Detect scope: "own" if user created it, else "organisation"
  const scope = await detectScopeCached(
    ctx.user.id,
    ctx.activeOrg.id,
    "datapoint",
    body.datapointId,
  );

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "edit",
    "datapoint",
    body.datapointId,
    scope,
  );

  if (!allowed) return 403;
  // ... proceed ...
}
```

### Audit Log Verification

Every permission check automatically creates an audit log entry in the `policy-evaluations` collection:

```json
{
  "userId": "user-123",
  "organisationId": "org-456",
  "action": "approve",
  "resource": "datapoint",
  "resourceId": "dp-789",
  "decision": "allowed",
  "reason": "User role 'Admin' can approve datapoint within organisation",
  "userRole": "Admin",
  "evaluatedAt": "2026-07-28T20:47:43Z"
}
```

Query audit logs via the API:

```bash
# View all access decisions for a user
GET /api/app/policies/audit-logs?userId=USER_ID&organisationId=ORG_ID

# View denied access attempts only
GET /api/app/policies/audit-logs?organisationId=ORG_ID&decision=denied

# Filter by resource and action
GET /api/app/policies/audit-logs?organisationId=ORG_ID&resource=datapoint&action=approve
```

### Performance Considerations

- **Scope Detection Caching**: `detectScopeCached()` caches results for 1 hour to prevent N+1 DB queries
- **Permission Checks**: Each check is ~2-5ms (one DB query to fetch user's role and capabilities)
- **Audit Logging**: Non-blocking (failures don't affect the main operation)
- **Recommended**: For endpoints called frequently, consider caching effective capabilities per user at the application level

---

## Migration Guide (Remaining Routes)

To integrate ABAC into the remaining 32 routes:

1. **Import requirePermission**: Add `import { requirePermission } from "@/lib/policy/protect"`
2. **Remove old role checks**: Replace `if (ctx.role === "viewer") { return 403; }` with the ABAC check
3. **Choose action/resource/scope**:
   - Action: `view`, `create`, `edit`, `delete`, `approve`, `export`, `manage-users`, `manage-policies`
   - Resource: `datapoint`, `report`, `supplier`, `user`, `evidence`, etc.
   - Scope: Use `"organisation"` as default, use `detectScopeCached()` for "own" vs "organisation" distinction
4. **Test end-to-end**: Verify the endpoint still works and audit logs appear
5. **Verify capabilities**: Check that default roles have the required capabilities in `src/lib/policy/defaultRoles.ts`
