# ABAC Testing Guide

## Pre-Test Checklist ✅

- [x] Code builds successfully (npm run build)
- [x] All TypeScript types are generated (npm run generate:types)
- [x] All ESLint checks pass
- [x] Payload collections are configured
- [x] Default roles are defined
- [x] API endpoints are created
- [x] Unit tests are written

---

## Step 1: Start the Development Server

```bash
npm run dev
```

Expected output:

```
▲ Next.js 16.2.10
- Local: http://localhost:3000
```

---

## Step 2: Verify Payload Collections

1. Navigate to: `http://localhost:3000/admin`
2. Login with Payload admin credentials
3. In the sidebar, verify these new collections exist:
   - ✅ **policy-roles** (predefined roles)
   - ✅ **user-policies** (user role assignments)
   - ✅ **policy-evaluations** (audit logs)

Expected: All 3 collections visible in admin UI

---

## Step 3: Check Default Roles Were Seeded

1. Click on "policy-roles" collection
2. You should see 4 entries:
   - ✅ Admin
   - ✅ Contributor
   - ✅ Viewer
   - ✅ Consultant

If empty, run seeding manually:

```typescript
// In your instrumentation or startup code
import { seedDefaultRoles } from "@/lib/policy";
const payload = await getPayload({ config });
await seedDefaultRoles(payload);
```

Expected columns:

- name, description, defaultCapabilities, isSystem, createdAt

---

## Step 4: Test API Endpoints

### 4A: List Roles

```bash
curl "http://localhost:3000/api/app/policies/roles"
```

Expected response:

```json
[
  {
    "id": "...",
    "name": "Admin",
    "description": "Full access to all resources and settings",
    "defaultCapabilities": [...],
    "isSystem": true
  },
  ...
]
```

### 4B: Evaluate Permission (Allowed)

First, manually create a test user policy:

1. In Payload admin, go to user-policies
2. Click "Create new"
3. Select a test user, select an organisation
4. Select "Contributor" role
5. Save

Then test:

```bash
curl -X POST "http://localhost:3000/api/app/policies/evaluate" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID_HERE",
    "organisationId": "ORG_ID_HERE",
    "action": "view",
    "resource": "datapoint",
    "resourceId": "dp-123",
    "scope": "organisation"
  }'
```

Expected response (✅ allowed):

```json
{
  "decision": "allowed",
  "reason": "User role 'Contributor' can view datapoint within organisation"
}
```

Check audit log was created:

```bash
curl "http://localhost:3000/api/app/policies/audit-logs?organisationId=ORG_ID_HERE"
```

### 4C: Evaluate Permission (Denied - Insufficient Scope)

```bash
curl -X POST "http://localhost:3000/api/app/policies/evaluate" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID_HERE",
    "organisationId": "ORG_ID_HERE",
    "action": "delete",
    "resource": "datapoint",
    "resourceId": "dp-123",
    "scope": "organisation"
  }'
```

Expected response (❌ denied):

```json
{
  "decision": "denied",
  "reason": "User role 'Contributor' does not have permission for delete on datapoint"
}
```

### 4D: Evaluate Permission (Denied - No Policy)

```bash
curl -X POST "http://localhost:3000/api/app/policies/evaluate" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "UNKNOWN_USER",
    "organisationId": "ORG_ID_HERE",
    "action": "view",
    "resource": "datapoint",
    "resourceId": "dp-123"
  }'
```

Expected response (❌ denied):

```json
{
  "decision": "denied",
  "reason": "No policy found for user"
}
```

---

## Step 5: Test Custom Capability Overrides

### 5A: Create Custom Policy

In Payload admin:

1. Go to user-policies
2. Click on the test policy you created
3. Under "customCapabilities", click "Add"
4. Set: action="approve", resource="datapoint", scope="organisation", isGrant=true
5. Save

### 5B: Test Override

```bash
curl -X POST "http://localhost:3000/api/app/policies/evaluate" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID_HERE",
    "organisationId": "ORG_ID_HERE",
    "action": "approve",
    "resource": "datapoint",
    "resourceId": "dp-123",
    "scope": "organisation"
  }'
```

Expected response (✅ allowed):

```json
{
  "decision": "allowed",
  "reason": "User role 'Contributor' can approve datapoint within organisation"
}
```

---

## Step 6: Test Revocation

### 6A: Revoke a Capability

In Payload admin:

1. Go to user-policies
2. Add another custom capability:
   - action="view", resource="compliance", scope="all", isGrant=**false** (revoke)
3. Save

### 6B: Test Revoke

Even though "Contributor" role includes view:compliance, the custom revoke should block it:

```bash
curl -X POST "http://localhost:3000/api/app/policies/evaluate" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID_HERE",
    "organisationId": "ORG_ID_HERE",
    "action": "view",
    "resource": "compliance",
    "resourceId": "compliance-123"
  }'
```

Expected response (❌ denied):

```json
{
  "decision": "denied",
  "reason": "Permission for view on compliance has been explicitly revoked"
}
```

---

## Step 7: Audit Log Verification

Check all evaluations were logged:

```bash
curl "http://localhost:3000/api/app/policies/audit-logs?organisationId=ORG_ID_HERE&limit=50"
```

Expected: Array of evaluation records with:

- userId
- organisationId
- action
- resource
- resourceId
- decision (allowed/denied)
- reason
- userRole
- evaluatedAt (ISO timestamp)

Sample:

```json
{
  "docs": [
    {
      "id": "...",
      "userId": "user-123",
      "organisationId": "org-456",
      "action": "view",
      "resource": "datapoint",
      "resourceId": "dp-789",
      "decision": "allowed",
      "reason": "User role 'Contributor' can view datapoint within organisation",
      "userRole": "Contributor",
      "evaluatedAt": "2026-07-28T20:33:31.000Z"
    },
    ...
  ],
  "totalDocs": 5,
  "limit": 50
}
```

---

## Step 8: Run Unit Tests

```bash
npm test -- evaluator.test.ts
```

Expected: All tests pass ✅

```
✓ ABAC Policy Evaluator
  ✓ evaluatePolicy
    ✓ should allow view action when capability exists
    ✓ should deny action when capability does not exist
    ✓ should deny revoked capability
    ✓ should respect scope hierarchy
    ... (more tests)
  ✓ mergeCapabilities
    ✓ should start with role defaults
    ✓ should override with custom capabilities
    ... (more tests)
```

---

## Test Results Checklist

### Must Pass ✅

- [ ] Build succeeds (npm run build)
- [ ] 3 collections visible in Payload admin
- [ ] 4 default roles seeded
- [ ] GET /api/app/policies/roles returns 4 roles
- [ ] POST /api/app/policies/evaluate allows Contributor to view datapoint
- [ ] POST /api/app/policies/evaluate denies Contributor from deleting
- [ ] Custom capability override works (grant approve)
- [ ] Custom capability revoke works (deny compliance view)
- [ ] Audit logs are created for every evaluation
- [ ] Unit tests pass

### Expected Metrics

- **API Endpoints**: 4 working
  - GET /api/app/policies/roles ✅
  - POST /api/app/policies/evaluate ✅
  - GET|POST /api/app/policies/users ✅
  - GET /api/app/policies/audit-logs ✅
- **Database Collections**: 3 active
  - policy-roles ✅
  - user-policies ✅
  - policy-evaluations ✅
- **Default Roles**: 4 system roles
  - Admin ✅
  - Contributor ✅
  - Viewer ✅
  - Consultant ✅
- **Test Coverage**: 100%
  - evaluator.test.ts ✅

---

## Troubleshooting

### Collections not showing in admin UI

**Cause**: Payload types not regenerated after adding collections

**Fix**:

```bash
npm run generate:types
npm run dev
```

### API returns "collection unknown"

**Cause**: Collection name mismatch in code vs Payload config

**Check**:

- Collection slug in route.ts matches collection in config
- Example: `collection: "policy-evaluations"` must match PayloadEvaluations slug

### Audit logs not being created

**Cause**: Audit logger is non-blocking, might not see immediate results

**Check**:

1. Wait 1-2 seconds after calling evaluate endpoint
2. Query audit-logs endpoint
3. Check browser console for any errors (they'll be logged but not thrown)

### Custom capabilities not overriding defaults

**Cause**: Type mismatch in custom capability format

**Check**:

- action must be exact value from: view, create, edit, delete, approve, export, manage-users, manage-policies
- scope must be: own, team, organisation, or all
- isGrant must be boolean (true for grant, false for revoke)

---

## Next Steps (After Testing)

Once all tests pass:

1. ✅ ABAC system is production-ready
2. → Integrate into existing API routes (Days 2-3)
3. → Build admin UI (Days 7-8)
4. → CSV import with policy enforcement (Days 4-6)

Document any issues found during testing for the next phase.
