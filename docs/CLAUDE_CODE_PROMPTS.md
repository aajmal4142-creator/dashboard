# Claude Code Prompts for 60-Day Sprint

## Copy-paste ready prompts for each day

---

## PHASE 1: FOUNDATION (Days 1-10)

### Day 2: Pricing Page Build

```
Create a professional pricing page at /src/app/(frontend)/pricing/page.tsx with:
- 4 tiers: Starter ($299/mo), Professional ($999/mo), Enterprise ($3,999/mo), White-Label ($2,000/mo + 20% revenue share)
- Each tier shows: monthly price, features included, user limit, support level
- Feature comparison table (rows = features, columns = tiers, checkmarks for included)
- FAQ section with 5-7 common questions
- CTA button on each tier: "Get Started" → redirects to app.clearesg.com/login
- Responsive design (mobile-first, tablet, desktop)
- Color scheme: Use ClearESG brand colors (blue #3b82f6, green #10b981)
- No authentication required on this page
- SEO meta tags for pricing page
```

### Day 3: CSRD Landing Page

```
Create SEO-optimized CSRD landing page at /src/app/(frontend)/csrd/page.tsx:
- Hero section: "CSRD Compliance Made Simple"
- "Deadline: June 2025 (60 days left)"
- Pain points: Why CSRD matters (5 points)
- How ClearESG helps (with feature benefits)
- Compliance checklist (materiality, data collection, evidence, reporting)
- Customer testimonial (if available, or placeholder)
- CTA: "Start CSRD Compliance" → app.clearesg.com/login
- Mobile responsive
- Include schema markup for SEO
- Meta description for search engines
```

### Day 3: BRSR Landing Page

```
Create BRSR landing page at /src/app/(frontend)/brsr/page.tsx:
- Hero: "BRSR Reporting for India (June 2025 Deadline)"
- Headline: "3 Business Responsibility Heads - Simplified"
- Target audience: Listed companies on BSE/NSE
- BRSR requirements explained (simplified)
- Why ClearESG for BRSR (localization, templates, compliance)
- India-specific compliance checklist
- "How BRSR differs from CSRD" comparison
- CTA: "Prepare for BRSR" → app.clearesg.com/login
- Hindi terms explained
- Mobile responsive
```

### Day 4: Blog Setup & Posts

```
Setup blog infrastructure and write 2 SEO posts:

1. Create blog structure:
   - /src/app/(frontend)/blog/ directory
   - /src/app/(frontend)/blog/page.tsx (list all posts)
   - /src/app/(frontend)/blog/[slug]/page.tsx (single post template)
   - Support for markdown frontmatter (title, date, author, excerpt, tags)
   - Add blog posts to sitemap.xml for SEO

2. Write post 1: "What is CSRD and Why You Need to Comply by 2025"
   - 1500+ words
   - Cover: What is CSRD, deadline, penalties, requirements
   - Audience: CFO, sustainability officer, ESG manager
   - Include internal links to pricing page and CSRD landing page
   - Meta description for SEO
   - Featured image placeholder

3. Write post 2: "BRSR vs. CSRD: Which Framework Does Your Company Need?"
   - 1500+ words
   - Compare CSRD (EU), BRSR (India), GRI (voluntary)
   - Deadline comparison
   - Requirements comparison
   - Target audience: Global companies in India
   - Include internal links
   - Meta description for SEO

Both posts should be:
- SEO-optimized (include target keywords)
- Include author bio
- Include publish date
- Include tags (CSRD, BRSR, ESG, Compliance)
```

---

## PHASE 2: ABAC FEATURE BUILD (Days 11-30)

### Days 13-15: ABAC Policy Engine

```
Build ABAC policy engine with:

1. Policy Parser (lib/abac/parser.ts):
   - Parse policy rules like: (User.department == "Operations") AND (Resource.metricKey CONTAINS "scope1") → Can edit
   - Support operators: ==, !=, CONTAINS, >=, <=, AND, OR, ()
   - Return AST (abstract syntax tree)
   - Validate syntax (throw errors for invalid rules)

2. Policy Evaluator (lib/abac/evaluator.ts):
   - Evaluate parsed policy against user + resource attributes
   - User attributes: role, department, seniority, organization
   - Resource attributes: metricKey, period.status, org_id, owner
   - Return: { allow: boolean, reason: string }
   - Add caching (Redis/in-memory, 5-minute TTL)
   - Log decision with confidence score

3. Audit Logger (lib/abac/auditLog.ts):
   - Log every policy evaluation
   - Store: userId, resourceId, policyId, decision (allow/deny), timestamp, IP, userAgent
   - Create PolicyEvaluation Payload collection

4. Test the engine with 10 sample policies:
   - Operations team edit Scope 1
   - Contributors create datapoints during open period
   - Admins approve all
   - Viewers read-only access
   - Plus 6 more edge cases
```

### Days 16-18: ABAC Database Integration

```
Integrate ABAC into ClearESG database:

1. Create Payload Collections:
   - PolicyDefinition: id, name, description, rules, status (active/inactive), createdBy, createdAt, modifiedAt
   - PolicyEvaluation: id, userId, resourceId, policyId, decision, reason, timestamp, ip, userAgent (append-only)

2. Modify existing collections to check policies:
   - Datapoint: Add policy check before GET (read), CREATE (create), UPDATE (edit), DELETE (delete)
   - Period: Add policy check before modify
   - Organisation: Add policy check before settings change
   - Use middleware or hooks to enforce policies

3. Create API endpoints:
   - POST /api/policies - create policy
   - GET /api/policies - list policies
   - GET /api/policies/:id - get single policy
   - PATCH /api/policies/:id - update policy
   - DELETE /api/policies/:id - delete policy (soft delete, set status=inactive)
   - GET /api/policies/audit - audit log (filtered by user, resource, action)
   - POST /api/policies/test - test if policy allows action

4. Add policy evaluation to all query middleware:
   - Before returning data, check if user has permission
   - Return 403 Forbidden if policy denies
   - Log decision to audit log
```

### Days 19-21: ABAC Admin Dashboard UI

```
Build ABAC policy management dashboard at /src/app/(frontend)/dashboard/settings/policies/:

1. Policy List Page:
   - Table with columns: Name, Description, Status (Active/Inactive toggle), Actions (Edit, Delete, Test)
   - Search bar (filter by name)
   - "Create New Policy" button
   - Show policy rule in simplified format

2. Create Policy Form:
   - Name input
   - Description textarea
   - Rule builder (visual + text):
     - User attribute selector: role, department, seniority, etc.
     - Operator selector: ==, !=, CONTAINS, >=, <=
     - Value input
     - AND/OR buttons to add conditions
     - Parentheses for grouping
   - Action selector: Can create, Can edit, Can delete, Can read
   - Status: Active/Inactive toggle
   - Save button

3. Edit Policy Form:
   - Same as create, but pre-filled
   - Show who created it + when
   - Show modification history (links to audit log)

4. Test Policy Modal:
   - "Test this policy"
   - Input: Select user + select resource
   - Output: "Allow/Deny" + reason
   - Show which conditions passed/failed

5. Policy Presets (quick create):
   - "Operations team: Edit Scope 1 only"
   - "Contributor: Create datapoints during open period"
   - "Admin: Approve all datapoints"
   - "Viewer: Read-only access"
   - Click preset → auto-fill form

6. Audit Log Viewer:
   - Table: User, Resource, Action (Allow/Deny), Reason, Timestamp, IP
   - Filters: By user, resource, action, date range
   - Export to CSV

All UI should be:
- Responsive (mobile-friendly)
- Dark mode support
- Accessible (WCAG 2.1)
- Intuitive for non-technical admins
```

---

## PHASE 3: QUICK WINS (Days 31-45)

### Days 33-35: CSV Import Build

```
Build CSV import feature:

1. Create CSV template at /public/templates/metrics_import.csv:
   - Columns: MetricKey, Value, Unit, Quality
   - Include all 40 ESG metrics as examples
   - Sample data
   - Add download link on data entry page

2. Build CSV upload component (/src/components/CSVImportUpload.tsx):
   - Drag-and-drop zone + file picker
   - Accept .csv files only
   - Show file preview (first 5 rows)
   - Progress bar (parsing, validating, importing)
   - Error summary (which rows failed)

3. Build CSV parser (lib/csv/parser.ts):
   - Parse CSV file
   - Validate columns: MetricKey, Value, Unit, Quality
   - Validate each row:
     - MetricKey must exist in database
     - Value must be numeric
     - Unit must match metric definition
     - Quality must be one of: measured, estimated, missing
   - Return: { success: [rows], errors: [{ line, error }] }

4. Build error recovery:
   - Show which rows failed + why
   - Allow user to download error report
   - Suggest fixes: "Row 5: Unit 'kWh' doesn't match metric 'MWh'"
   - Re-upload corrected CSV

5. Create datapoints:
   - On success, batch create datapoints in database
   - Link to evidence file (if CSV came from Excel with attachments)
   - Show confirmation: "Imported 38/40 metrics"
   - Link to metrics that failed (for manual entry)

6. Test with sample CSVs (valid + error cases)
```

### Days 36-38: OCR Integration

```
Build OCR extraction from PDFs/images:

1. Integrate OCR API (use Google Vision API or Tesseract):
   - Setup API key + authentication
   - Build wrapper function (lib/ocr/extract.ts):
     - Input: Image/PDF file
     - Output: { text: extracted text, confidence: 0-100 }
     - Handle errors gracefully

2. Build extraction logic (lib/ocr/metricExtraction.ts):
   - Parse extracted text for metric patterns
   - Look for keywords: "MWh", "tCO2e", "headcount", "employees", "kWh"
   - Extract numbers before/after keywords
   - Map to ClearESG metrics
   - Return: { metric: string, value: number, unit: string, confidence: 0-100 }

3. Build OCR upload component (/src/components/OCRUpload.tsx):
   - Upload PDF/image
   - Show loading state ("Extracting data...")
   - Display extracted values:
     - Show confidence score
     - Allow user to accept/reject/edit
   - "Save to metric" button
   - Link extracted evidence to datapoint

4. Add to data entry flow:
   - "Upload energy bill" → OCR → "Found electricity: 12,400 MWh (high confidence)" → Accept
   - Datapoint created with evidence link

5. Example: Energy bill OCR
   - Input: Energy bill PDF
   - Extract: "Annual electricity: 12,400 MWh"
   - Output: MetricKey="electricity_kwh", Value=12400000, Unit="kWh", Evidence="energy_bill.pdf"

Test with real invoices/bills
```

### Days 39-40: Anomaly Detection Logic

```
Build anomaly detection engine:

1. Define anomalies (lib/anomalies/detector.ts):
   - Year-over-year: Value > 2x last year OR < 0.5x last year
   - Peer comparison: Value > 1.5x peer median OR < 0.7x
   - Consistency check: Scope 1 high but headcount stable = potential anomaly
   - Evidence gaps: Value > 1000 tCO2e but 0 evidence = flag

2. Build detection function:
   - Input: Current datapoint + historical data + peer stats
   - Output: { isAnomaly: boolean, reasons: [], confidence: 0-100 }
   - Use statistical methods (Z-score, IQR)

3. Generate suggested actions:
   - "Did you add facilities? Update employee count."
   - "Scope 2 spike: Did you move locations?"
   - "Upload evidence to verify this outlier."
   - "Compare to 2024: 2024=500, 2025=1000. Are you sure? 🤔"

4. Calculate confidence scoring:
   - Factor in: data quality, peer data volume, historical consistency
   - Return 0-100 confidence

5. Create Anomaly entity (database):
   - Store: metricKey, value, reason, confidence, status (flagged, reviewed, dismissed)

Example anomalies to detect:
- Electricity doubled but headcount same
- Scope 1 emissions 10x peer median
- Missing evidence for high-value metrics
```

### Days 41-43: Anomaly Dashboard UI

```
Build anomaly dashboard widget:

1. Add anomaly card to main dashboard:
   - "Unusual figures detected (3)"
   - List top 3 anomalies
   - Click "View all" to see full list

2. Anomaly detail view (/src/app/(frontend)/dashboard/anomalies/):
   - List all anomalies with status (flagged, reviewed, dismissed)
   - For each anomaly show:
     - Metric name + current value
     - Reason ("Year-over-year spike")
     - Confidence score (visual bar)
     - Year-over-year comparison (chart or numbers)
     - Peer median comparison
     - Suggested action with link ("Jump to metric" → data entry form)
     - Status toggle: Flagged → Reviewed → Dismissed

3. Add to next actions table:
   - Include anomalies in priority list
   - "Review unusual figure: Scope 2 electricity" → Click → Anomaly detail

4. Filter/sort options:
   - Sort by: Confidence, Metric, Date
   - Filter by: Status, Metric type (Scope 1/2/3, Social, Governance)

5. Bulk actions:
   - "Mark all as reviewed" button
   - Export anomaly report (CSV)

Visual design:
- Use color coding: Red (high confidence), Yellow (medium), Green (low confidence)
- Show icons for anomaly type (spike, drop, outlier)
- Make it easy to take action (one-click "Jump to metric")
```

---

## PHASE 4: DASHBOARD IMPROVEMENTS (Days 46-55)

### Days 46-47: Emissions Breakdown

```
Build enhanced emissions visualization:

1. Replace pie chart with stacked bar chart:
   - X-axis: Scope 1, Scope 2, Scope 3
   - Y-axis: tCO2e (0 to max)
   - Each scope bar shows breakdown by source:
     - Scope 1: Fuel (%), Refrigerants (%), Other (%)
     - Scope 2: Electricity (%), Steam (%), Other (%)
     - Scope 3: Supplier (%), Logistics (%), Waste (%), Other (%)
   - Hover: Show exact numbers

2. Add year-over-year trend:
   - "2024: 1,000 tCO2e vs. 2025: 950 tCO2e"
   - Show trend arrow (up/down/flat)
   - Percentage change: "-5% 📉"
   - Add trend line (sparkline) showing 3-year history

3. Add peer benchmark line:
   - Show peer median on chart
   - Label: "Peer median: 850 tCO2e — You're at 50th percentile 📊"
   - Breakdown: "Q1=40%, Q2=50%, Q3=60%"

4. Add intensity metric:
   - Calculate: tCO2e per $1M revenue
   - Show: "20 tCO2e per $1M revenue (peer: 18, you're +11%)"
   - Link: "Improve efficiency" CTA

Use Recharts or similar library for visualization
```

### Days 48-49: Data Quality Scoring

```
Build data quality dashboard:

1. Calculate quality metrics:
   - % measured (high quality)
   - % estimated (medium quality)
   - % missing (needs data entry)
   - Example: 60% measured, 30% estimated, 10% missing

2. Show in dashboard:
   - Donut/pie chart showing breakdown
   - Metric summary: "60% of data is measured from invoices/meters"
   - Trend line: "Quality improved from 40% → 60% this quarter 📈"

3. Impact analysis:
   - "Estimated metrics affect 20% of total Scope 1 emissions"
   - "High priority: Get evidence for top 5 high-value metrics"

4. Confidence badge:
   - "Data Confidence: 85% Verified 🟢"
   - Hover shows:
     - Which metrics are supplier-verified
     - Which are internal estimates
     - Which are missing

5. Quality targets:
   - Goal: "Reach 80% measured by Q4"
   - Progress: "Currently 60%, need 20% more"
   - Suggested actions: "Collect evidence for electricity, gas, water"

Visual design:
- Use green (measured), yellow (estimated), red (missing)
- Show icons for data source (invoice, meter, estimate)
```

### Days 50-51: Compliance Roadmap

```
Build compliance roadmap timeline:

1. Timeline view:
   - Horizontal timeline: Today → Future
   - Milestones:
     - "CSRD due June 2025 (60 days left)" — Red if urgent
     - "BRSR due June 2026 (400 days left)" — Yellow if medium-term
     - "EU Taxonomy 2027" — Gray if far future
   - Show progress: "CSRD: 60% ready 📊"

2. Prep checklist for CSRD:
   - Materiality assessment: 80% complete ✅
   - Data collection: 60% complete 🔄
   - Evidence gathering: 60% complete 🔄
   - Supplier verification: 40% complete 🔄
   - Report draft: 0% complete ⬜
   - Items linked to actual metrics (progress updates in real-time)

3. Checklist for BRSR:
   - 3 Business Responsibility Heads: Understanding
   - 76 KPI disclosures: Understanding
   - Material topics: Planning
   - Supply chain scope: Planning

4. Task assignment:
   - Assign prep tasks to team members
   - Due dates tied to compliance deadlines
   - Status: Not started, In progress, Blocked, Complete
   - Notifications: "Task due tomorrow", "Overdue task"

5. Interactive features:
   - Click metric → Jump to data entry
   - Click task → Show details + edit
   - "Generate compliance report" button
   - "Export compliance roadmap" (PDF)

Visual design:
- Gantt-style chart showing timeline
- Color coding by status (green/yellow/red)
- Icons for each framework (CSRD, BRSR, Taxonomy)
```

### Days 52-53: Peer Benchmarking Heatmap

```
Build peer benchmarking dashboard:

1. Create heatmap:
   - Rows: ESG metrics (Scope 1, Scope 2, Scope 3, Social, Governance)
   - Columns: Your org, Peer median, Peer Q1, Peer Q3
   - Cell values: tCO2e, headcount, %, etc.
   - Color coding:
     - Green: Better than peer median (50th percentile)
     - Yellow: Close to peer median
     - Red: Worse than peer median
   - Hover: Show exact numbers + percentile rank

2. Drill-down view:
   - Click metric → Show distribution chart
   - Show where you rank: "You're in 40th percentile (bottom 40%)"
   - Show peer range: "Peer min=100, max=5000, median=850"
   - Highlight: Are you an outlier? (top 10% or bottom 10%)

3. Peer anonymization:
   - Don't show company names
   - Show: "Peer median", "Peer Q1", "Peer Q3"
   - Explain: "Aggregate data from 50+ companies in your sector"

4. Sector selector:
   - Filter by: Sector, Company size, Geography (optional)
   - "Showing peers: Tech companies, 1000-5000 employees, EMEA region"

5. Actions:
   - "Download benchmarking report" (PDF)
   - "Set improvement target" (e.g., "Reduce to peer median by Q4")
   - "Compare to specific peer" (if customer chooses to share)

Visual design:
- Heatmap styled with gradient colors
- Show metric categories with icons
- Easy export/download
```

### Days 54-55: Report Preview Mode

```
Build report preview & polish:

1. Draft mode:
   - Before publishing, show "Preview mode"
   - Display what stakeholders will see
   - Read-only (no editing in preview)
   - All data locked as it will appear in final report

2. Compliance checklist:
   - Show required CSRD elements:
     - Materiality matrix: ✅
     - Scope 1/2/3: ✅
     - Evidence links: ⚠️ Missing 3
     - Board approval: ⬜
   - Show warnings: "Missing evidence for 3 metrics"
   - Click warning → "Jump to metric" → Fix → Checkbox auto-updates

3. Completeness check:
   - "Report completion: 85%"
   - "Estimated time to publish: 2 hours"
   - "Show what's blocking publish"

4. One-click fixes:
   - "Missing evidence" → Click → Jump to data entry → Upload evidence → Done
   - "Missing metric" → Click → Go to entry form → Fill → Done

5. Responsive polish:
   - Test on mobile: All new widgets responsive
   - Fix typography: Ensure proper sizing
   - Fix spacing: Proper padding/margins
   - Test dark mode: All widgets work in dark theme
   - Accessibility: WCAG 2.1 compliant

6. Final QA:
   - No console errors
   - All links work
   - Charts render correctly
   - Data updates in real-time
   - Performance: Page load < 2 seconds
```

---

## PHASE 5: AUTH PLANNING (Days 56-59)

### Days 56-57: Custom Auth Design

```
Research and document custom auth requirements:

Create /docs/CUSTOM_AUTH_SPEC.md with:

1. Auth flow diagrams (detailed):
   - Signup flow: Email → verify email → set password → dashboard
   - Login flow: Email + password → optional MFA → session token → cookie
   - Logout flow: Delete session → clear cookie
   - Password reset: Email link (1-hour TTL) → set new password

2. Security requirements:
   - Password: bcrypt/argon2, minimum 12 characters, complexity rules
   - Session: 30-day TTL, refresh token rotation, HTTP-only cookies
   - MFA: Support TOTP (authenticator apps) + SMS options
   - Rate limiting: 5 failed attempts = 15-minute lockout
   - Audit logging: Every login/logout/failed attempt with IP + user agent

3. Database schema:
   - Users table: id, email, password_hash, email_verified, mfa_enabled, created_at, updated_at
   - Sessions table: id, user_id, token, ip, user_agent, created_at, expires_at
   - AuditLog table: id, user_id, action, status (success/failed), ip, user_agent, created_at

4. API contracts (endpoints + request/response):
   - POST /auth/signup { email, password } → { user_id, status }
   - POST /auth/verify-email { email, code } → { verified: true }
   - POST /auth/login { email, password } → { session_token, mfa_required }
   - POST /auth/mfa/verify { session_token, mfa_code } → { token, expires_at }
   - POST /auth/logout → { success: true }
   - POST /auth/password-reset { email } → { reset_link_sent: true }
   - POST /auth/password-reset/confirm { token, new_password } → { success: true }

5. Compliance:
   - GDPR: Data residency (store users in EU if EU customer)
   - BRSR: Access logs for audit (who accessed what, when)
   - SOC 2: Password encryption, session security, audit trails

6. Security checklist (OWASP Top 10):
   - Injection: Parameterized queries
   - Broken authentication: MFA, password policy, rate limiting
   - Sensitive data: HTTPS, hash passwords, encrypt sessions
   - XML external entities: N/A for auth
   - Broken access control: Enforce via policies (ABAC)
   - Security misconfiguration: TLS 1.2+, secure headers
   - XSS: Sanitize inputs, CSP headers
   - Insecure deserialization: Use JSON only
   - Using components with known vulnerabilities: Audit deps
   - Insufficient logging: Full audit trail
```

### Days 58-59: Migration Plan

```
Create /docs/CUSTOM_AUTH_MIGRATION_PLAN.md:

1. Migration timeline (Q3 2025 start):
   - Week 1: Set up auth service + database
   - Week 2: Implement login/signup endpoints
   - Week 3: Add MFA + password reset
   - Week 4: Testing + security review
   - Week 5: Parallel running (new users on custom, old on Clerk)
   - Week 6: Gradual migration of existing users
   - Week 7: Full cutover (turn off Clerk)

2. Data export from Clerk:
   - Export user list (email, user_id)
   - Get password hashes (if available) or mark for reset
   - Get MFA settings (if applicable)
   - Map to custom auth user schema

3. Parallel running strategy:
   - New signups → Custom auth only
   - Existing Clerk users → Still on Clerk (request auth from Clerk)
   - Gradual migration: Weekly, migrate 10% of users
   - Fallback: If custom auth fails, redirect to Clerk

4. Cutover plan:
   - Set Clerk to read-only (no new logins)
   - Migrate final 10% of users
   - Turn off Clerk
   - Monitor for issues (24/7 for 1 week)

5. Rollback plan:
   - Keep Clerk active for 1 month (just in case)
   - If critical issues found, can fall back to Clerk
   - Monitor error rates, login success %, user feedback

6. Team responsibilities:
   - Backend engineer: Auth service build
   - Frontend engineer: Login/signup UI updates
   - DevOps: Database + security infrastructure
   - QA: Testing + security validation
   - Support: Customer communication

Document:
- Why custom auth (control, security, white-label, no vendor lock-in)
- Risk mitigation (testing, parallel running, rollback)
- Timeline with milestones
- Success criteria (no user complaints, <0.1% failed logins)
```

---

## QUICK REFERENCE

### Copy-Paste Template

```
Claude, build [FEATURE NAME]:

Deliverables:
1. [Item 1]
2. [Item 2]
3. [Item 3]

Location: [file paths]
Time: [X hours]
Details: [Copy exact prompt from CLAUDE_CODE_PROMPTS.md]

Test thoroughly before committing!
```

### Git Commit Messages

```
Day 1: Pricing strategy & validation
Day 2: Add pricing page
Day 3: Add CSRD & BRSR landing pages
Day 4: Add blog infrastructure & posts
Day 5: Customer validation plan
Day 11: ABAC design & spec
Day 13: ABAC policy engine
Day 16: ABAC database & API
... and so on
```

### Testing Checklist (Before Commit)

```
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Responsive (mobile + desktop)
- [ ] Dark mode works
- [ ] All links work
- [ ] Data displays correctly
- [ ] Performance: < 2 second load
- [ ] Accessibility: Keyboard nav + screen reader
```

---

**Last Updated**: 2025-07-27  
**Use this file every day to copy exact prompts for Claude Code**
