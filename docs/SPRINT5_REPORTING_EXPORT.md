# SPRINT 5: Reporting & Export (Week 9-10)

## PDF/Excel/JSON Export, Report Distribution, Bulk CSV Update

**Total Effort**: 28-38 hours | **Team**: 2 engineers | **Dependencies**: Sprint 1-4

---

## FEATURE 17: PDF EXPORT ENHANCEMENT

### Requirements

- [ ] Download reports as branded PDF (org logo, colors)
- [ ] Support all report types (CSRD, TCFD, GRI, BRSR, SASB, etc)
- [ ] Include charts, tables, narratives
- [ ] Password-protected PDF option
- [ ] Watermark option ("CONFIDENTIAL", org name)

### Implementation

```
Use: react-pdf or puppeteer for PDF generation
Approach:
  1. Fetch report data from API
  2. Render report as React component
  3. Convert to PDF (using pdf-lib or similar)
  4. Apply branding (logo, colors, fonts)
  5. Download to user

Alternatively (if react-pdf insufficient):
  - Use puppeteer to screenshot HTML → PDF
  - Supports complex layouts better
```

### Database Schema

```typescript
// Add to Reports collection:
{
  pdfSettings: {
    includeCharts: boolean,
    includeNarratives: boolean,
    includeAppendices: boolean,
    watermark?: string, // "CONFIDENTIAL"
    fontSize: 'small' | 'normal' | 'large',
  }
}
```

### PDF Features

```
1. Cover Page
   - Report title, org name, period, date

2. Table of Contents
   - Auto-generated from sections

3. Executive Summary
   - Key metrics, trends, highlights

4. Main Content
   - Sections per framework (CSRD E1-G2, TCFD, etc)
   - Charts and tables
   - Narratives

5. Appendices
   - Data sources, methodology
   - Compliance checklist
   - Glossary
```

### API Endpoints

```
GET /api/app/reports/[id]/export/pdf
  - Query: ?format=a4|letter&watermark=CONFIDENTIAL
  - Returns: PDF file (Content-Type: application/pdf)

POST /api/app/reports/[id]/export/pdf
  - For custom PDF settings
  - Body: { watermark, fontSize, includeCharts }
```

### Testing

- [ ] PDF generated without errors
- [ ] All content included
- [ ] Charts render correctly
- [ ] Branding applied
- [ ] File size reasonable (<50MB)
- [ ] Works in all browsers

**Effort**: 6-8h

---

## FEATURE 18: EXCEL/CSV EXPORT

### Requirements

- [ ] Export report data to Excel (structured format)
- [ ] Multiple sheets (one per framework section)
- [ ] Include formulas (for YoY calculations)
- [ ] Style headers (bold, colors)
- [ ] Auto-fit columns

### Implementation

```
Use: xlsx or exceljs library
Approach:
  1. Fetch report data
  2. Create workbook with multiple sheets
  3. Sheet 1: Summary (key metrics)
  4. Sheet 2-N: Detailed data per framework
  5. Add formatting (headers, alternating colors)
  6. Download as .xlsx
```

### Workbook Structure

```
Sheet 1: Summary
  - Key metrics: total emissions, by scope, intensity
  - YoY comparison
  - Targets vs actual

Sheet 2: Scope 1/2/3 Details
  - All datapoints: date, value, unit, status
  - Calculations: emissions factors used
  - Trends

Sheet 3: Supplier Data
  - Supplier name, category, emissions, risk score
  - Questionnaire responses

Sheet 4: Compliance Status
  - Framework, topic, status, gaps
  - Findings, actions

Sheet 5: Audit Trail
  - Changes, approvals, who did what
```

### API Endpoints

```
GET /api/app/reports/[id]/export/xlsx
  - Returns: Excel file

GET /api/app/reports/[id]/export/csv
  - Returns: Single CSV (summary)
```

### Testing

- [ ] Excel opens without errors
- [ ] All data included
- [ ] Formatting applied
- [ ] Formulas calculate correctly
- [ ] CSV parses correctly

**Effort**: 6-8h

---

## FEATURE 19: JSON/XML EXPORT

### Requirements

- [ ] Export report as structured JSON
- [ ] Export as XML for integrations
- [ ] Support schema validation
- [ ] Include metadata (created date, version, etc)

### JSON Structure

```json
{
  "report": {
    "id": "report-123",
    "type": "csrd",
    "organisationId": "org-123",
    "period": "2026-Q3",
    "createdAt": "2026-07-31",
    "metadata": {
      "version": "1.0",
      "schema": "https://clearesq.io/schemas/report-v1.json"
    },
    "summary": {
      "scope1": 1500,
      "scope2": 500,
      "scope3": 3000,
      "total": 5000
    },
    "sections": [
      {
        "topic": "E1-Climate",
        "status": "disclosed",
        "metrics": [...]
      }
    ],
    "audit": {
      "status": "verified",
      "verifiedBy": "auditor@example.com",
      "verifiedAt": "2026-07-31"
    }
  }
}
```

### API Endpoints

```
GET /api/app/reports/[id]/export/json
GET /api/app/reports/[id]/export/xml
```

### Testing

- [ ] JSON valid and parseable
- [ ] XML valid and well-formed
- [ ] Schema validation passes
- [ ] Metadata included

**Effort**: 4-6h

---

## FEATURE 20: REPORT DISTRIBUTION LIST

### Requirements

- [ ] Define recipient lists (emails)
- [ ] Schedule automatic delivery (monthly, quarterly)
- [ ] Track delivery status (sent, failed, opened)
- [ ] Allow recipients to download directly
- [ ] Unsubscribe link

### Database Schema

```typescript
ReportDistributions: {
  reportId: reference,
  organisationId: reference,
  name: string, // "Board Monthly"
  schedule: 'manual' | 'weekly' | 'monthly' | 'quarterly',
  recipients: [{
    email: string,
    name: string,
    role?: string,
  }],
  format: 'pdf' | 'xlsx' | 'html',
  includeWatermark: boolean,
  enabled: boolean,
  lastSentAt?: date,
  nextScheduledAt?: date,
  createdAt: date,
}

DeliveryLogs: {
  distributionId: reference,
  recipients: [{
    email: string,
    status: 'sent' | 'failed' | 'opened',
    sentAt: date,
    openedAt?: date,
    failureReason?: string,
  }],
}
```

### Implementation

1. Create distribution config UI
2. Set recipients and schedule
3. Create scheduler job (background)
4. Send emails with download links
5. Track opens/failures

### UI Components

- [ ] Distribution settings page
- [ ] Recipient list editor
- [ ] Schedule selector (cron)
- [ ] Delivery history view
- [ ] Manual send button

### Email Template

```
Subject: Your Monthly ESG Report - ClearESG

Hi [Name],

Your requested ESG report is ready!

[View Online] [Download PDF] [Download Excel]

The report covers [period] and includes:
- Total emissions: 5000 tCO2e
- YoY change: +10%
- Compliance status: 85% complete

This link expires in 30 days.

Best regards,
ClearESG
[Unsubscribe Link]
```

### Testing

- [ ] Distribution created successfully
- [ ] Schedule triggers on time
- [ ] Emails sent to all recipients
- [ ] Download links work
- [ ] Track delivery status

**Effort**: 6-8h

---

## FEATURE 21: BULK CSV UPDATE

### Requirements

- [ ] Upload CSV to update existing datapoints
- [ ] Match datapoints by ID or unique key
- [ ] Show preview before applying
- [ ] Validate all rows before committing
- [ ] Rollback if errors

### Workflow

```
1. Upload CSV file
   - Columns: datapoint_id, field, new_value
   - Or: metric, period, value (auto-match)

2. Validation
   - Check all datapoints exist
   - Check all values valid
   - Show preview: "Will update 100 datapoints"

3. Dry-run
   - Show calculated changes
   - Show any conflicts

4. Apply
   - Update all datapoints
   - Create version entry for each
   - Log to activity feed
   - Track in BulkOperationTransactions
```

### CSV Format

```
datapoint_id,new_value,reason
dp-001,520,Corrected meter reading
dp-002,515,Updated from latest report
```

### API Endpoints

```
POST /api/app/data/bulk-update
  - Body: CSV file
  - Response: { validated: number, preview: [...] }

POST /api/app/data/bulk-update/apply
  - Body: { bulkUpdateId, proceed: true }
  - Response: { updated: number, errors: [...] }
```

### Testing

- [ ] CSV parsed correctly
- [ ] Validation catches errors
- [ ] Preview shows changes
- [ ] Dry-run doesn't modify data
- [ ] Apply updates database
- [ ] Rollback on error
- [ ] Versions created

**Effort**: 6-8h

---

## SPRINT 5 SUMMARY

| Feature             | Effort     |
| ------------------- | ---------- |
| PDF Export          | 6-8h       |
| Excel/CSV Export    | 6-8h       |
| JSON/XML Export     | 4-6h       |
| Report Distribution | 6-8h       |
| Bulk CSV Update     | 6-8h       |
| **TOTAL**           | **28-38h** |

## Success Criteria

- [ ] All export formats working
- [ ] PDFs professionally formatted
- [ ] Distribution schedules trigger
- [ ] Bulk updates tracked and reversible
- [ ] All tests passing

---

## CURSOR NOTES

- PDF generation most complex → test thoroughly
- Excel formatting use library (exceljs recommended)
- Distribution uses background job (Cron or Bull queue)
- CSV bulk update needs transaction support
