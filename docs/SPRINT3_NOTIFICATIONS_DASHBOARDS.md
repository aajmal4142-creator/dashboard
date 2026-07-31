# SPRINT 3: Notifications & Dashboards (Week 5-6)

## In-App Notifications, Custom Dashboard, Advanced Alerts, Custom Metrics

**Total Effort**: 38-48 hours | **Team**: 2 engineers | **Dependencies**: Sprint 1-2

---

## FEATURE 9: IN-APP NOTIFICATION SYSTEM

### Requirements

- [ ] Real-time notifications for: datapoint approved, report ready, audit complete
- [ ] Notification bell icon (top navbar)
- [ ] Notification list (badge shows unread count)
- [ ] Mark as read/unread
- [ ] Delete notifications
- [ ] Group by type

### Database Schema

```typescript
Notifications: {
  userId: reference,
  organisationId: reference,
  type: 'datapoint_approved' | 'report_ready' | 'audit_complete' | 'alert_triggered',
  title: string,
  message: string,
  resourceType: string, // 'datapoint', 'report', 'audit'
  resourceId: string,
  isRead: boolean,
  createdAt: date,
  readAt?: date,
}
```

### API Endpoints

```
GET /api/app/notifications?limit=20&unreadOnly=false
GET /api/app/notifications/unread-count
PATCH /api/app/notifications/[id]/read
DELETE /api/app/notifications/[id]
```

### UI Components

- [ ] Notification bell icon (navbar)
- [ ] Notification dropdown list
- [ ] Notification detail view
- [ ] Mark as read button
- [ ] Group by type

### Trigger Rules

| Event                       | Notification                          |
| --------------------------- | ------------------------------------- |
| Datapoint status → Approved | "Sarah approved 'Q3 Emissions'"       |
| Report generated            | "CSRD Report ready for download"      |
| Audit engagement completed  | "Audit of Q3 data complete"           |
| Alert threshold exceeded    | "Emissions spike: 50% above baseline" |
| Supplier response received  | "Acme Inc replied to questionnaire"   |

### Testing

- [ ] Notification created on trigger event
- [ ] Mark as read → updates UI
- [ ] Unread count accurate
- [ ] Delete removes notification
- [ ] Real-time updates via WebSocket/polling

**Effort**: 8-10h

---

## FEATURE 10: CUSTOM DASHBOARD BUILDER

### Requirements

- [ ] Users customize dashboard (add/remove/reorder widgets)
- [ ] Save multiple dashboard layouts
- [ ] Drag-drop interface
- [ ] Widget types: chart, metric card, table, list
- [ ] Different roles get different defaults

### Database Schema

```typescript
DashboardLayouts: {
  userId: reference,
  organisationId: reference,
  name: string, // "Finance View", "Operations View"
  isDefault: boolean,
  widgets: [{
    id: string,
    type: 'chart' | 'metric' | 'table' | 'list',
    title: string,
    position: { x: number, y: number }, // Grid layout
    size: { w: number, h: number },
    config: {
      metric: string, // 'scope1_total', 'scope2_intensity'
      timeRange: '1m' | '3m' | '6m' | '1y',
      filters: {...}
    },
  }],
  createdAt: date,
  updatedAt: date,
}
```

### Drag-Drop Implementation

- Use `react-beautiful-dnd` or similar
- 12-column grid layout
- Widget sizes: small (3x3), medium (6x4), large (12x6)
- Save layout on every drop

### Widget Types

```
1. METRIC CARD
   - Value: 5000 tCO2e
   - Change: +10% vs last period
   - Trend: small sparkline

2. CHART
   - Line/bar/pie chart
   - Emissions over time or by category
   - Configurable time range

3. TABLE
   - Top suppliers by emissions
   - Recent datapoints
   - Configurable columns

4. LIST
   - Pending approvals (5 items)
   - Alerts triggered today
   - Activities from team
```

### API Endpoints

```
POST /api/app/dashboards
  - Create dashboard layout

GET /api/app/dashboards
  - List all layouts for user

PATCH /api/app/dashboards/[id]
  - Update layout (widget positions)

DELETE /api/app/dashboards/[id]
  - Delete layout

PATCH /api/app/dashboards/[id]/default
  - Set as default dashboard
```

### Testing

- [ ] Drag widget → position updates
- [ ] Save layout → persists across sessions
- [ ] Default layout applied to new users
- [ ] Widget data refreshes in real-time
- [ ] Performance: dashboard loads <1s

**Effort**: 12-16h

---

## FEATURE 11: ADVANCED ALERT THRESHOLDS

### Requirements

- [ ] Define complex alert conditions (not just value > X)
- [ ] Conditions: consecutive periods, % change, cross-metric
- [ ] Send alerts via notification + email + Slack
- [ ] Mute alerts for specific periods
- [ ] Alert dashboard (show active/triggered)

### Database Schema

```typescript
AlertRules: {
  organisationId: reference,
  name: string, // "Scope1 spike alert"
  enabled: boolean,
  condition: {
    type: 'threshold' | 'consecutive' | 'percent_change' | 'cross_metric',
    metric: string, // 'scope1_emissions'
    operator: 'gt' | 'lt' | 'eq',
    value: number,
    consecutivePeriods?: number, // Alert if X > threshold for 2+ periods
    percentChange?: number, // Alert if >20% change vs previous
  },
  actions: ['notify_user', 'send_email', 'post_slack'],
  muted: boolean,
  mutedUntil?: date,
  createdAt: date,
  triggeredCount: number,
}
```

### Alert Examples

```
1. THRESHOLD: Scope1 > 1000 tCO2e
2. CONSECUTIVE: Energy usage > 500 MWh for 2+ periods
3. PERCENT CHANGE: Emissions +20% vs previous month
4. CROSS-METRIC: If Scope1 > average AND Scope2 > average
```

### Trigger Rules

When condition met:

1. Create alert record
2. Send in-app notification
3. Send email (if configured)
4. Post to Slack (if integrated)
5. Log to activity feed

### Testing

- [ ] Alert triggers on condition met
- [ ] Consecutive condition evaluates correctly
- [ ] Percent change calculated right
- [ ] Notifications sent
- [ ] Mute prevents alerts

**Effort**: 8-10h

---

## FEATURE 12: CUSTOM METRIC BUILDER UI

### Requirements

- [ ] Users create custom metrics without code
- [ ] Example: (Scope1 + Scope2) / Revenue
- [ ] Metric available in reports, dashboards, comparisons
- [ ] Validate formula (check field references exist)
- [ ] Show calculation preview

### Database Schema

```typescript
DerivedMetricDefinitions: {
  organisationId: reference,
  name: string, // "Carbon Intensity"
  formula: string, // "(scope1 + scope2) / revenue"
  description: string,
  category: string, // "intensity", "efficiency"
  unit: string, // "kg CO2e / $M revenue"
  enabled: boolean,
  usageCount: number,
  createdAt: date,
  createdBy: userId,
}
```

### Formula Builder UI

```
Step 1: Define Metric
  - Name: "Carbon per Employee"
  - Description: Total emissions / headcount
  - Category: Efficiency

Step 2: Build Formula
  - Available fields dropdown: scope1, scope2, scope3, headcount
  - Operators: +, -, *, /, (,)
  - Formula input: (scope1 + scope2) / headcount
  - Preview calculation: 5000 / 150 = 33.3

Step 3: Set Unit & Save
  - Unit: "kg CO2e per employee"
  - Save metric
```

### Formula Validation

- [ ] Check referenced fields exist
- [ ] Check formula is valid math (no syntax errors)
- [ ] Check for division by zero (headcount=0)
- [ ] Show error messages

### Implementation

1. Create FormulaBuilder component
2. Parse and validate formula
3. Calculate metric on datapoint fetch
4. Store result in cache (avoid recalculation)
5. Use in reports/dashboards

### Testing

- [ ] Create metric with valid formula
- [ ] Invalid formula shows error
- [ ] Metric calculated correctly
- [ ] Preview shows right result
- [ ] Metric available in dashboards

**Effort**: 10-12h

---

## SPRINT 3 SUMMARY

| Feature              | Effort     |
| -------------------- | ---------- |
| In-App Notifications | 8-10h      |
| Custom Dashboard     | 12-16h     |
| Advanced Alerts      | 8-10h      |
| Custom Metrics       | 10-12h     |
| **TOTAL**            | **38-48h** |

## Success Criteria

- [ ] Notifications working in real-time
- [ ] Dashboard customization intuitive
- [ ] Alerts trigger correctly
- [ ] Custom metrics calculate accurately
- [ ] All tests passing

---

## CURSOR NOTES

- Use existing collections where possible
- Drag-drop is most complex → test thoroughly
- Formula validation critical (prevent crashes)
- Real-time updates use WebSocket or polling
