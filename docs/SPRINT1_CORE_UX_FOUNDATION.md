# SPRINT 1: Core UX Foundation (Week 1-2)

## Dark Mode, Keyboard Shortcuts, Advanced Search, Activity Feed

**Total Effort**: 25-30 hours  
**Team**: 1-2 Frontend engineers  
**Dependencies**: None (standalone features)

---

## FEATURE 1: DARK MODE

### Requirements

- [ ] Implement CSS-in-JS theme system (light/dark toggle)
- [ ] Persist user preference to database
- [ ] Apply to ALL pages (100% coverage)
- [ ] Support system preference detection (prefers-color-scheme)
- [ ] Create color palette for dark mode
- [ ] Test contrast ratios (WCAG AA minimum)

### Technical Approach

1. Create theme context using Next.js + Tailwind CSS
2. Add theme toggle button in user settings + navbar
3. Store preference in Users collection: `themePreference: "light" | "dark" | "system"`
4. Use CSS variables for all colors (no hardcoded hex values)
5. Apply to Payload CMS admin panel too

### Database Changes

```typescript
// In Users collection, add:
themePreference: {
  type: 'select',
  options: ['light', 'dark', 'system'],
  defaultValue: 'system'
}
```

### UI Components to Build

- [ ] Theme toggle button (sun/moon icon)
- [ ] Settings page: Theme preference selector
- [ ] Color palette definition file

### CSS Variables to Define

```css
--bg-primary: #ffffff (light) / #1a1a1a (dark) --bg-secondary: #f5f5f5 / #2d2d2d
  --text-primary: #000000 / #ffffff --text-secondary: #666666 / #999999
  --border-color: #e0e0e0 / #404040 --hover-bg: #f0f0f0 / #333333
  (continue for all UI colors);
```

### Pages to Update (100% Coverage)

- [ ] /dashboard
- [ ] /datapoints, /reports, /suppliers
- [ ] /assurance, /compliance, /frameworks
- [ ] /settings, /billing, /teams
- [ ] /admin/policies, /admin/roles
- [ ] /audit-logs, /integrations
- [ ] Modal dialogs, tooltips, alerts

### Testing Checklist

- [ ] Manual test: All pages readable in dark mode
- [ ] Automated: Check contrast ratios (WCAG AA)
- [ ] Test on different monitors (brightness levels)
- [ ] Test system preference auto-switch
- [ ] Test persistence across page reloads
- [ ] Test toggle button responsiveness

### Edge Cases

- [ ] User opens app at night → system preference is dark
- [ ] User switches theme → page updates instantly
- [ ] Images/charts work in both modes (preserve readability)
- [ ] Embedded iframes (reports) handle theme

**Effort**: 6-8 hours  
**Acceptance**: All pages dark mode ready + tests passing

---

## FEATURE 2: KEYBOARD SHORTCUTS

### Requirements

- [ ] Implement Cmd+K (or Ctrl+K on Windows/Linux) for global search
- [ ] Implement Cmd+S to save datapoint (if in edit mode)
- [ ] Implement Escape to close modals
- [ ] Implement Cmd+/ to show help/shortcuts
- [ ] Show shortcut hints in UI (e.g., "Press Cmd+K to search")
- [ ] Create settings to customize shortcuts

### Technical Approach

1. Use `react-hotkeys-hook` or `useKeyPress` hook
2. Create global keyboard event listener
3. Add shortcut registry in context/store
4. Show help modal with all shortcuts
5. Integrate with search feature (Feature 3)

### API Endpoints

- [ ] None (client-side feature)

### Database Changes

```typescript
// In Users collection, add:
keyboardShortcutSettings: {
  type: 'json',
  defaultValue: {
    search: ['meta', 'k'],        // Cmd+K
    save: ['meta', 's'],          // Cmd+S
    closeModal: ['escape'],       // Escape
    help: ['meta', '/'],          // Cmd+/
  }
}
```

### Shortcuts to Implement

| Shortcut     | Action                       | Context                |
| ------------ | ---------------------------- | ---------------------- |
| Cmd/Ctrl + K | Open global search           | Everywhere             |
| Cmd/Ctrl + S | Save datapoint               | In datapoint edit mode |
| Escape       | Close modal                  | Modal open             |
| Cmd/Ctrl + / | Show keyboard shortcuts help | Everywhere             |
| Cmd/Ctrl + N | New datapoint                | Dashboard              |
| Cmd/Ctrl + R | New report                   | Reports page           |
| Cmd/Ctrl + \ | Toggle sidebar               | Everywhere             |

### UI Components

- [ ] Keyboard shortcuts modal (Help)
- [ ] Shortcut hints in tooltips ("Press Cmd+K")
- [ ] Shortcut settings page (customize shortcuts)

### Implementation Steps

1. Create `useKeyboardShortcuts()` hook
2. Create global shortcut registry
3. Add shortcuts to all major pages
4. Build shortcuts help modal
5. Add tooltips showing shortcuts

### Testing

- [ ] Test each shortcut works as expected
- [ ] Test shortcuts don't conflict with browser shortcuts
- [ ] Test on Mac (Cmd), Windows/Linux (Ctrl)
- [ ] Test disabled shortcuts (when in input field)
- [ ] Test customization persists

### Edge Cases

- [ ] User typing in input field → Cmd+K shouldn't trigger search
- [ ] Cmd+S on Mac opens "Save As" in browser → prevent default
- [ ] Modal open → Escape closes modal, not page
- [ ] Shortcut customization conflict → show warning

**Effort**: 5-7 hours  
**Acceptance**: All shortcuts working + help modal + tests passing

---

## FEATURE 3: ADVANCED FULL-TEXT SEARCH

### Requirements

- [ ] Search across all datapoints, reports, suppliers, compliance items
- [ ] Filter results by type (datapoint/report/supplier/etc)
- [ ] Show search results with context/preview
- [ ] Keyboard shortcut: Cmd+K opens search
- [ ] Search in real-time as user types
- [ ] Save frequent searches

### Technical Approach

1. Use full-text search index (PostgreSQL `tsvector` or similar)
2. Create search API endpoint
3. Build search UI modal (Cmd+K trigger)
4. Add recent searches to browser storage
5. Optimize for performance (<200ms response)

### Database Changes

```typescript
// Add search index to collections:
// Datapoints, Reports, Suppliers, ComplianceAssessments, etc.
// Use database full-text search feature

// Add collection for SavedSearches (if users want):
SavedSearches: {
  organisationId: reference,
  query: string,
  filters: json,
  createdAt: date,
  lastUsed: date
}
```

### API Endpoints to Create

```
GET /api/app/search?q=emissions&type=datapoint&limit=20
  - Query string: q, type (datapoint|report|supplier|compliance|evidence)
  - Response: { results: [...], totalCount: number }
  - Returns top 20 results with preview

GET /api/app/search/recent
  - Returns user's recent searches (from browser storage or DB)

POST /api/app/search/save
  - Save a search for later

GET /api/app/search/saved
  - Get user's saved searches
```

### UI Components

- [ ] Search modal (triggered by Cmd+K)
- [ ] Search input with autocomplete
- [ ] Results list with type badges
- [ ] Recent searches dropdown
- [ ] Saved searches panel

### Search Fields to Index

```
Datapoints:
  - name, value, unit, metric, period, status, category

Reports:
  - title, description, status, reportType, period

Suppliers:
  - name, category, location, industry, riskScore

ComplianceAssessments:
  - framework, topic, status, findings
```

### Testing

- [ ] Search returns correct results
- [ ] Performance: <200ms for common queries
- [ ] Filters work (type=datapoint, etc)
- [ ] Recent searches saved and displayed
- [ ] Search works across all data types
- [ ] No sensitive data exposed in search

### Edge Cases

- [ ] Empty search → show recent searches
- [ ] Search with special characters (%, *, etc) → escape properly
- [ ] User deletes datapoint → removed from search index
- [ ] User has no search permissions → results filtered

**Effort**: 8-10 hours  
**Acceptance**: Search modal working + results accurate + <200ms performance

---

## FEATURE 4: ACTIVITY FEED / CHANGE LOG

### Requirements

- [ ] Show all user actions in organization (who did what, when)
- [ ] Track: datapoint created/updated/approved, report generated, supplier added, etc.
- [ ] Real-time updates (WebSocket or polling)
- [ ] Filter by user, action type, resource type, date range
- [ ] Pagination (latest 50 activities default)
- [ ] Export activity log as CSV

### Technical Approach

1. Use existing AuditLogs collection (enhance UI)
2. Create user-facing activity feed page
3. Add real-time updates via WebSocket or polling
4. Build filter UI
5. Create export functionality

### Database Schema

```typescript
// AuditLogs collection already exists
// Enhance with: activityType (string), displayName (readable format)
// Example: "Created datapoint 'Q3 Emissions'" instead of technical names
```

### API Endpoints

```
GET /api/app/activity-feed?limit=50&offset=0&userId=X&type=datapoint_created&dateFrom=2026-07-01
  - Response: { activities: [...], total: number }

GET /api/app/activity-feed/[organisationId]
  - Get all activities for org

POST /api/app/activity-feed/export
  - Export as CSV: timestamp, user, action, resource, details
```

### UI Components

- [ ] Activity feed page/widget
- [ ] Activity filters (user, type, date)
- [ ] Activity detail view (modal)
- [ ] Export button
- [ ] Real-time indicator ("New activities")

### Activities to Track

```
Datapoint Events:
  - created, updated, approved, rejected, deleted, bulk_imported

Report Events:
  - generated, published, shared, downloaded, emailed, scheduled

Supplier Events:
  - added, questionnaire_sent, response_received, risk_score_updated

Compliance Events:
  - assessment_created, assessment_completed, findings_submitted

User Events:
  - login, logout, settings_updated, role_changed
```

### Display Format Examples

```
"Sarah updated emissions datapoint 'Q3 Energy Usage' from 500 to 520 tCO2e"
"John approved supplier 'Acme Inc' risk score: 65/100"
"System generated TCFD report for 2026"
"Maria exported audit log (50 entries)"
```

### Testing

- [ ] All activity types tracked correctly
- [ ] Filters work (user, type, date)
- [ ] Pagination works
- [ ] Export produces valid CSV
- [ ] Performance with large activity logs
- [ ] Real-time updates work

### Edge Cases

- [ ] User deleted → show "Deleted User" instead of name
- [ ] Resource deleted → show "Deleted datapoint" with ID
- [ ] Admin views activity from other users → permission check
- [ ] Sensitive data not exposed in feed

**Effort**: 6-8 hours  
**Acceptance**: Activity feed page working + filters + export + tests passing

---

## SPRINT 1 SUMMARY

| Feature            | Effort     | Status             | Dependencies         |
| ------------------ | ---------- | ------------------ | -------------------- |
| Dark Mode          | 6-8h       | Not started        | None                 |
| Keyboard Shortcuts | 5-7h       | Not started        | None                 |
| Advanced Search    | 8-10h      | Not started        | None                 |
| Activity Feed      | 6-8h       | Not started        | AuditLogs collection |
| **TOTAL**          | **25-30h** | **Ready to start** | **None**             |

## Success Criteria

- [ ] All 4 features implemented and tested
- [ ] Dark mode applied to 100% of pages
- [ ] Search <200ms performance
- [ ] No regression in existing features
- [ ] TypeScript strict mode passing
- [ ] All tests passing

---

## CURSOR IMPLEMENTATION NOTES

- Start with Dark Mode (most straightforward)
- Then Keyboard Shortcuts (low risk)
- Then Advanced Search (highest complexity)
- Finally Activity Feed (uses existing AuditLogs data)
- Keep code modular (reusable hooks/components)
- No external dependencies if possible (use existing libraries in project)
