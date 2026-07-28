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
