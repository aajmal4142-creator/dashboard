# SPRINT 6: Advanced Features (Week 11-12)

## Comparison Tools, Mobile Report View, Multi-Language, Help/Guides

**Total Effort**: 40-50 hours | **Team**: 2 engineers | **Dependencies**: Sprint 1-5

---

## FEATURE 22: COMPARISON TOOLS (Enhanced)

### Requirements

- [ ] Compare emissions YoY (2024 vs 2025)
- [ ] Compare by department/facility/supplier
- [ ] Compare multiple periods (Q1 vs Q2 vs Q3)
- [ ] Show % change and absolute change
- [ ] Visual comparison (side-by-side charts)

### Database Schema

```typescript
// Comparisons are calculated on-the-fly, not stored
// Add comparison view parameters:
ComparisonFilters: {
  type: 'yoy' | 'by_department' | 'by_supplier' | 'by_metric',
  period1: string, // 'Q3-2025'
  period2: string, // 'Q3-2024'
  groupBy?: string, // 'department', 'supplier', 'metric'
  filters?: {
    department?: string[],
    supplier?: string[],
    metricType?: string,
  }
}
```

### Comparison Views

```
1. YoY Comparison
   2025 Q3: 5000 tCO2e
   2024 Q3: 4545 tCO2e
   Change: +455 tCO2e (+10%)

2. By Department
   Finance:    800 tCO2e (+5%)
   Operations: 2500 tCO2e (+15%)
   Sales:      1700 tCO2e (0%)

3. By Supplier
   Supplier A: 1500 tCO2e (+8%)
   Supplier B: 1200 tCO2e (-5%)
   Supplier C: 2300 tCO2e (+20%)

4. Multi-Period
   Q1: 4500
   Q2: 5100 (+13%)
   Q3: 5000 (-2%)
   Q4: (forecast) 5200 (+4%)
```

### UI Components

- [ ] Comparison selector (YoY, By Dept, etc)
- [ ] Period/dimension picker
- [ ] Results table with % change
- [ ] Charts (bar, line for trends)
- [ ] Export comparison to CSV/PDF

### API Endpoints

```
POST /api/app/analytics/compare
  - Body: { type, period1, period2, groupBy, filters }
  - Response: { comparison: { baseline: {...}, current: {...}, change: {...} } }

GET /api/app/analytics/compare/presets
  - Pre-defined comparisons (YoY, Q1 vs Q4, etc)
```

### Testing

- [ ] YoY calculation accurate
- [ ] Grouping correct
- [ ] % change calculated right
- [ ] Charts render correctly
- [ ] Export works

**Effort**: 10-12h

---

## FEATURE 23: MOBILE-FRIENDLY REPORT VIEW

### Requirements

- [ ] Reports render on mobile (iPad, iPhone)
- [ ] Responsive layout (stacked on mobile)
- [ ] Swipe between sections
- [ ] Touch-friendly buttons
- [ ] Print-friendly stylesheet

### Implementation

```
Approach:
  1. Use CSS media queries (@media max-width: 768px)
  2. Stack sections vertically on mobile
  3. Charts adaptive (smaller on mobile)
  4. Tables scrollable horizontally
  5. Add "mobile" view mode toggle

CSS Strategy:
  - Desktop: 2-3 columns
  - Tablet: 1.5 columns
  - Mobile: 1 column

Touch:
  - Buttons 44px minimum (thumb-friendly)
  - Tap to expand/collapse sections
  - Swipe to next section
```

### Responsive Breakpoints

```
Desktop: >1024px  (3 columns)
Tablet:  768-1024px (2 columns)
Mobile:  <768px (1 column)
```

### Testing

- [ ] iPhone view readable
- [ ] iPad view optimal
- [ ] Touch interactions work
- [ ] Print format looks good
- [ ] Performance on mobile

**Effort**: 4-6h

---

## FEATURE 24: MULTI-LANGUAGE SUPPORT (i18n)

### Requirements

- [ ] Support: English, Spanish, French, German, Mandarin
- [ ] User can select language in settings
- [ ] All UI text translated
- [ ] Store preference in database
- [ ] Localized number/date formats

### Implementation

```
Use: next-i18next or i18next
Structure:
  - /public/locales/en/common.json
  - /public/locales/es/common.json
  - /public/locales/fr/common.json
  - /public/locales/de/common.json
  - /public/locales/zh/common.json

Key pattern:
  t('datapoint.created')
  t('common.save')
  t('metrics.scope1_emissions')
```

### Database Changes

```typescript
Users: {
  language: 'en' | 'es' | 'fr' | 'de' | 'zh',
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY',
  timeZone: 'UTC' | 'America/New_York' | etc,
  numberFormat: 'en-US' | 'de-DE' | etc, // 1,000.50 vs 1.000,50
}
```

### Translation Files

```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete"
  },
  "datapoint": {
    "created": "Datapoint created",
    "updated": "Datapoint updated"
  },
  "metrics": {
    "scope1": "Scope 1 Emissions",
    "scope2": "Scope 2 Emissions"
  }
}
```

### Localization Features

- [ ] Date format per locale (MM/DD vs DD/MM)
- [ ] Number format (1,000.50 vs 1.000,50)
- [ ] Currency symbol
- [ ] RTL support (for Arabic, if needed)

### Pages to Translate

- [ ] All UI pages
- [ ] Reports (narratives)
- [ ] Email templates
- [ ] Error messages
- [ ] Help content

### Testing

- [ ] All UI strings translated
- [ ] Language persists across sessions
- [ ] Date/number formats correct per locale
- [ ] Reports translate correctly
- [ ] No broken keys (missing translations)

**Effort**: 16-20h

---

## FEATURE 25: HELP/DOCUMENTATION (In-App Tours)

### Requirements

- [ ] Guided tours for new features
- [ ] Help modal (Cmd+/ trigger)
- [ ] Context-sensitive help (current page)
- [ ] Video tutorials (links to external)
- [ ] FAQ section
- [ ] Interactive walkthroughs

### Implementation

```
Use: Shepherd.js or similar tour library
Approach:
  1. Create tour definitions for each major flow
  2. Display tour on first visit (or manual trigger)
  3. Show step-by-step guidance with overlays
  4. Allow skip, back, next
  5. Mark as completed
```

### Tours to Create

```
1. "First Time Setup"
   - Create org
   - Add team members
   - Add first datapoint
   - Approve & generate report

2. "Datapoint Entry"
   - Open datapoint form
   - Fill in fields
   - Add evidence
   - Submit for approval

3. "Report Generation"
   - Select framework
   - Choose period
   - Generate report
   - Download/share

4. "Supplier Management"
   - Add supplier
   - Send questionnaire
   - Review responses
   - Calculate risk
```

### UI Components

- [ ] Tour overlay (highlight current step)
- [ ] Tour progress indicator (Step 1 of 5)
- [ ] Navigation buttons (Back, Next, Skip, Done)
- [ ] Help button (main nav)
- [ ] Help modal with search

### API Endpoints

```
GET /api/app/help/tours
  - Get all available tours

POST /api/app/help/tours/[tourId]/complete
  - Mark tour as completed

GET /api/app/help/faq
  - Get FAQ articles
```

### Help Content Structure

```
/docs/tours/ (JSON files)
  - first-setup.json
  - datapoint-entry.json
  - report-generation.json
  - supplier-management.json

/docs/help/ (Markdown files)
  - getting-started.md
  - faq.md
  - glossary.md
```

### Testing

- [ ] Tours play correctly
- [ ] Overlay highlights correct element
- [ ] Navigation works
- [ ] Completion persists
- [ ] Help modal searchable

**Effort**: 10-12h

---

## SPRINT 6 SUMMARY

| Feature                | Effort     |
| ---------------------- | ---------- |
| Comparison Tools       | 10-12h     |
| Mobile Report View     | 4-6h       |
| Multi-Language Support | 16-20h     |
| Help/Documentation     | 10-12h     |
| **TOTAL**              | **40-50h** |

## Success Criteria

- [ ] Comparisons calculated accurately
- [ ] Reports mobile-friendly
- [ ] All UI translated (5 languages)
- [ ] Tours helpful and easy to follow
- [ ] All tests passing

---

## CURSOR NOTES

- Multi-language most time-consuming → plan translation workflow
- Comparison tools are calculation-heavy → optimize queries
- Tours use library (Shepherd recommended)
- Help content maintainable (use markdown + JSON for tours)
