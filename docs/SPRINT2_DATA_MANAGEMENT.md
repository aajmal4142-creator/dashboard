# SPRINT 2: Data Management & Validation (Week 3-4)

## Custom Validation Rules UI, Data Lineage, Version Comparison, Bulk Undo

**Total Effort**: 35-45 hours  
**Team**: 2 engineers (1 backend, 1 frontend)  
**Dependencies**: Sprint 1 (Advanced Search, Activity Feed)

---

## FEATURE 5: CUSTOM DATA VALIDATION RULES UI

### Requirements

- [ ] UI to create custom validation rules (no-code rule builder)
- [ ] Rule types: value range, required field, pattern match, cross-field logic
- [ ] Rules apply before datapoint approval
- [ ] Show validation errors clearly in UI
- [ ] Save rules per organization
- [ ] Apply rules retroactively to existing datapoints

### Technical Approach

1. Create rule builder UI (drag-drop or form-based)
2. Store rules in DataQualityRules collection (already exists)
3. Validate datapoints against rules in API
4. Show validation results in datapoint UI
5. Allow bulk rule application

### Database Changes

```typescript
// Enhance DataQualityRules collection:
{
  organisationId: reference,
  name: string, // "Emissions must have intensity"
  description: string,
  ruleType: 'range' | 'required' | 'pattern' | 'cross_field',
  condition: {
    field: string, // "value"
    operator: 'gt' | 'lt' | 'eq' | 'between' | 'exists' | 'matches',
    value: any,
    secondValue?: any, // for 'between'
  },
  crossFieldRules?: [{
    if: { field: string, operator: string, value: any },
    then: { field: string, must: string, value?: any }
  }],
  errorMessage: string, // Custom error message
  severity: 'error' | 'warning', // Warn vs block
  enabled: boolean,
  createdAt: date,
  appliedCount: number, // Track usage
}
```

### Rule Types & Examples

```
1. VALUE RANGE:
   - Scope1 emissions must be between 0 and 10000 tCO2e

2. REQUIRED FIELD:
   - If metric is "Electricity", then "Renewable %" must be provided

3. PATTERN MATCH:
   - Supplier name must match pattern (no special chars)
   - Date must be YYYY-MM-DD format

4. CROSS-FIELD:
   - If emission type = "calculated", then intensity must be provided
   - If scope = Scope3, then supplier must be specified

5. CONSISTENCY:
   - Current period emissions shouldn't differ >30% from previous period

6. DATA TYPE:
   - Value must be number (not text)
   - Field must be ISO date format
```

### API Endpoints

```
POST /api/app/validation-rules
  - Create new rule
  - Body: { name, ruleType, condition, errorMessage, severity }
  - Returns: rule ID

GET /api/app/validation-rules
  - List all rules for org

PATCH /api/app/validation-rules/[ruleId]
  - Update rule

DELETE /api/app/validation-rules/[ruleId]
  - Delete rule

POST /api/app/validation-rules/[ruleId]/apply
  - Apply rule to existing datapoints
  - Returns: { validated: number, failed: number, errors: [...] }

POST /api/app/datapoints/validate
  - Validate datapoint against all rules
  - Body: { datapointData: {...} }
  - Returns: { valid: boolean, errors: [...], warnings: [...] }
```

### UI Components

- [ ] Rule builder form (rule creation)
- [ ] Rule list page (manage rules)
- [ ] Rule tester (test rule on sample data)
- [ ] Validation error display (in datapoint form)
- [ ] Validation summary (X rules failing)

### Rule Builder Form

```
Section 1: Basic Info
  - Rule name input
  - Rule description textarea

Section 2: Condition Builder (Drag-drop or Select)
  - Field selector dropdown
  - Operator selector (>, <, =, between, exists, matches)
  - Value input(s)
  - Add Another Condition button

Section 3: Error Message
  - Error message (if condition fails)
  - Severity selector (Error vs Warning)

Section 4: Apply Rule
  - Test on sample data
  - Apply to existing datapoints
  - Save rule
```

### Implementation Steps

1. Create ValidationRuleBuilder component
2. Add validation logic to datapoint creation/update API
3. Create UI to list/manage rules
4. Add rule testing tool
5. Create bulk validation runner
6. Add validation error display in datapoint form

### Testing

- [ ] Create rule → save successfully
- [ ] Apply rule to datapoint → validation triggers
- [ ] Multiple rules → all evaluated
- [ ] Invalid datapoint → shows all rule violations
- [ ] Edit rule → applies to future datapoints
- [ ] Bulk apply → validates all existing datapoints
- [ ] Performance: rule evaluation <50ms per datapoint

### Edge Cases

- [ ] User creates conflicting rules → warn them
- [ ] Rule references deleted field → handle gracefully
- [ ] Apply rule to 10K datapoints → background job
- [ ] Regex pattern rule with invalid regex → validation error

**Effort**: 10-12 hours  
**Acceptance**: Rule builder working + validation triggered + tests passing

---

## FEATURE 6: DATA LINEAGE VISUALIZATION

### Requirements

- [ ] Show visual graph of how datapoint was created/transformed
- [ ] Trace: source data → calculations → final metric
- [ ] Show who touched the data and when
- [ ] Export lineage as image/PDF
- [ ] Integrate with Activity Feed (show changes over time)

### Technical Approach

1. Create lineage tracking system (metadata on each datapoint)
2. Build graph visualization UI (React Flow or Vis.js)
3. Trace data flow through transformations
4. Connect to Activity Feed for audit trail

### Database Changes

```typescript
// Enhance Datapoints collection:
{
  lineage: {
    source: 'manual' | 'import' | 'calculation' | 'webhook',
    sourceId: string, // CSV import ID, webhook ID, etc.
    calculationFormula?: string, // If calculated
    transformations: [{
      type: 'formula_applied' | 'unit_converted' | 'normalized',
      formula: string,
      timestamp: date,
      appliedBy: userId,
      before: number,
      after: number,
    }],
    predecessors: [datapointId], // Data this came from
  }
}

// New collection for tracking calculations:
CalculationHistory: {
  datapointId: reference,
  calculationType: string,
  inputs: { [key]: value },
  output: number,
  formula: string,
  timestamp: date,
  appliedBy: userId,
}
```

### UI Components

- [ ] Lineage graph viewer (modal/page)
- [ ] Node types: source data, calculation, final metric
- [ ] Timeline view (show transformations over time)
- [ ] Export buttons (PNG, PDF, JSON)
- [ ] Hover to show details (formula, timestamp, user)

### Visualization Features

```
Graph nodes:
  - Green: Source data (import, webhook, manual)
  - Blue: Calculations/transformations
  - Purple: Final metric

Edges show:
  - Calculation formula
  - Timestamp
  - Applied by (user)

Click node to see:
  - Before/after values
  - Formula used
  - Who changed it
  - When changed
```

### Implementation Steps

1. Create LineageTracker service
2. Record lineage on datapoint creation/update
3. Build LineageGraph component (React Flow)
4. Create lineage viewer modal
5. Add export functionality
6. Connect to Activity Feed

### Testing

- [ ] Lineage recorded for manual datapoints
- [ ] Lineage recorded for imported datapoints
- [ ] Lineage recorded for calculated datapoints
- [ ] Graph displays correctly
- [ ] Export to PNG/PDF works
- [ ] Performance with deep lineage chains

### Edge Cases

- [ ] Datapoint from deleted source → show "Source deleted"
- [ ] Circular references → detect and prevent
- [ ] Deep lineage (100+ transformations) → optimize rendering
- [ ] Export very large graph → handle gracefully

**Effort**: 12-14 hours  
**Acceptance**: Lineage graph working + export + tests passing

---

## FEATURE 7: DATA VERSION COMPARISON UI

### Requirements

- [ ] Show all versions of a datapoint with timestamps
- [ ] Compare any 2 versions side-by-side
- [ ] Show who made each change
- [ ] Highlight differences (what changed)
- [ ] Restore to previous version (already have API, need UI)

### Technical Approach

1. Use existing DatapointVersions collection
2. Build UI to list/compare versions
3. Add diff highlighting
4. Connect to rollback API

### Database Schema

```typescript
// DatapointVersions collection already exists
// Enhance with: changeDescription (why was it changed)
{
  datapointId: reference,
  version: number,
  value: number,
  previousValue: number,
  changeReason?: string, // "Corrected meter reading"
  changedBy: userId,
  changedAt: date,
  fields: {
    value: { old: number, new: number },
    unit: { old: string, new: string },
    status: { old: string, new: string },
    // etc for each field
  }
}
```

### UI Components

- [ ] Version list (timeline view)
- [ ] Version comparison modal (2-column view)
- [ ] Diff highlighting (red=removed, green=added)
- [ ] Restore button
- [ ] Change reason display

### Version Comparison View

```
Left Column (Version A)          Right Column (Version B)
Value: 500 tCO2e                 Value: 520 tCO2e ← CHANGED
Unit: tCO2e                      Unit: tCO2e
Status: Approved                 Status: Approved
Period: 2026 Q3                  Period: 2026 Q3
Changed by: John (Jul 15)        Changed by: Sarah (Jul 20)
```

### API Endpoints

```
GET /api/app/datapoints/[id]/versions
  - List all versions with timestamps

GET /api/app/datapoints/[id]/versions/compare?v1=1&v2=3
  - Compare 2 specific versions
  - Returns: { fields: { field: { old, new } } }

POST /api/app/datapoints/[id]/versions/restore?version=1
  - Restore to previous version (already exists)
```

### Testing

- [ ] Version list shows all changes chronologically
- [ ] Diff highlighting accurate
- [ ] Restore button works
- [ ] Change reasons displayed
- [ ] Performance with 100+ versions

### Edge Cases

- [ ] Restore to old version → creates new version (doesn't overwrite)
- [ ] User deleted → show "Deleted User"
- [ ] No change reason provided → show "No reason"
- [ ] Compare version with itself → show "No changes"

**Effort**: 6-8 hours  
**Acceptance**: Version comparison working + restore + tests passing

---

## FEATURE 8: BULK UNDO/REDO CAPABILITY

### Requirements

- [ ] Undo/redo for bulk operations (imports, updates, deletes)
- [ ] Show what will be undone before confirming
- [ ] Undo doesn't lose other recent changes
- [ ] Create transaction history for bulk ops

### Technical Approach

1. Implement transaction-based undo (not just rollback)
2. Store undo stack per organization
3. Track all changes in bulk operation
4. Allow selective undo (undo this operation only)

### Database Changes

```typescript
// New collection: BulkOperationTransactions
{
  organisationId: reference,
  operationType: 'bulk_import' | 'bulk_update' | 'bulk_delete',
  status: 'pending' | 'completed' | 'undone',
  createdAt: date,
  initiatedBy: userId,
  changes: [{
    resourceType: 'datapoint',
    resourceId: string,
    action: 'created' | 'updated' | 'deleted',
    before: object,
    after: object,
  }],
  totalAffected: number,
  undoneAt?: date,
  undoneBy?: userId,
}
```

### UI Components

- [ ] Transaction history view (timeline)
- [ ] Undo button for each transaction
- [ ] Preview before undo (X datapoints will be reverted)
- [ ] Confirmation modal

### Implementation

1. Wrap bulk operations in transactions
2. Record all changes (before/after state)
3. Add undo UI
4. Implement selective undo logic

### Testing

- [ ] Bulk import → can undo
- [ ] Undo removes all imported datapoints
- [ ] Undo doesn't affect other users' changes
- [ ] Undo creates activity log entry
- [ ] Performance: undo 1000 datapoints <5 seconds

**Effort**: 8-10 hours  
**Acceptance**: Bulk undo working + preview + tests passing

---

## SPRINT 2 SUMMARY

| Feature                 | Effort     | Status      |
| ----------------------- | ---------- | ----------- |
| Custom Validation Rules | 10-12h     | Not started |
| Data Lineage            | 12-14h     | Not started |
| Version Comparison      | 6-8h       | Not started |
| Bulk Undo/Redo          | 8-10h      | Not started |
| **TOTAL**               | **36-44h** | **Ready**   |

## Success Criteria

- [ ] All 4 features working end-to-end
- [ ] No data loss from undo operations
- [ ] Lineage graph performs well
- [ ] Validation prevents bad data
- [ ] All tests passing

---

## CURSOR NOTES

- Build in order: Validation Rules → Lineage → Version Comparison → Bulk Undo
- Each feature builds on previous one
- Use database transactions to maintain data integrity
- Performance testing required (especially lineage with large datasets)
