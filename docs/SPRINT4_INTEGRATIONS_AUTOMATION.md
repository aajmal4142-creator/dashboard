# SPRINT 4: Integrations & Automation (Week 7-8)

## Slack, Webhooks, API Rate Limiting, No-Code Automation

**Total Effort**: 30-40 hours | **Team**: 2 engineers | **Dependencies**: Sprint 1-3

---

## FEATURE 13: SLACK INTEGRATION

### Requirements

- [ ] Send notifications to Slack channels
- [ ] Support slash commands (/emissions show Q3)
- [ ] Support event triggers (datapoint approved, report ready)
- [ ] Install bot to Slack workspace
- [ ] Interactive messages (approve from Slack)

### Database Schema

```typescript
SlackIntegrations: {
  organisationId: reference,
  teamId: string, // Slack workspace ID
  botToken: string, // Encrypted
  channelMappings: [{
    event: 'datapoint_approved' | 'report_ready' | 'audit_complete',
    channelId: string,
    channelName: string,
  }],
  enableSlashCommands: boolean,
  enableInteractiveButtons: boolean,
  createdAt: date,
  createdBy: userId,
}
```

### API Endpoints (Slack APIs)

```
POST /api/integrations/slack/install
  - OAuth redirect for Slack install

POST /api/integrations/slack/events
  - Webhook for Slack event subscriptions

POST /api/integrations/slack/commands
  - Webhook for slash commands

POST /api/integrations/slack/interactions
  - Webhook for button clicks, modal submissions
```

### Slash Commands to Support

```
/emissions show q3
  → "Q3 Total Emissions: 5000 tCO2e (↑10% vs Q2)"

/emissions alerts
  → "3 active alerts: Scope1 spike, Energy >500 MWh"

/emissions approve [datapointId]
  → Approve datapoint from Slack

/emissions report [type]
  → Generate report (CSRD, TCFD, etc)
```

### Interactive Messages

```
When datapoint submitted for approval:
  "Sarah submitted Q3 Emissions: 5000 tCO2e"
  [Approve] [Request Changes] [Reject]

When report ready:
  "TCFD Report ready"
  [View] [Download] [Share]
```

### Implementation

1. Register Slack app
2. Setup OAuth flow
3. Create event listeners
4. Build slash command handlers
5. Create interactive message builders

### Testing

- [ ] Slack install flow works
- [ ] Notifications sent to correct channel
- [ ] Slash commands recognized
- [ ] Interactive buttons work
- [ ] Encrypted token storage

**Effort**: 8-10h

---

## FEATURE 14: WEBHOOK RETRY LOGIC ENHANCEMENT

### Requirements

- [ ] Automatic retry on webhook failure (exponential backoff)
- [ ] Configurable retry policy (max retries, delay)
- [ ] Webhook delivery dashboard (show status)
- [ ] Webhook testing tool (send test payload)
- [ ] Dead letter queue (failed webhooks)

### Database Changes

```typescript
// Enhance WebhookLogs collection:
{
  webhookId: reference,
  eventType: string,
  payload: object,
  status: 'success' | 'failed' | 'retrying',
  httpStatus?: number,
  response?: string,

  // Add retry tracking:
  retryCount: number,
  maxRetries: number,
  nextRetryAt?: date,
  lastAttemptAt: date,
  lastError: string,

  createdAt: date,
}

// Add webhook config:
WebhookRegistrations: {
  retryPolicy: {
    maxRetries: 5,
    initialDelaySeconds: 5,
    backoffMultiplier: 2, // 5s, 10s, 20s, 40s, 80s
  },
  deadLetterQueue?: { // For failed webhooks
    enabled: boolean,
    channel?: string, // Slack channel to notify
  }
}
```

### Retry Algorithm

```
Attempt 1: Immediate
Attempt 2: Wait 5s
Attempt 3: Wait 10s
Attempt 4: Wait 20s
Attempt 5: Wait 40s
Attempt 6: Wait 80s

After 6 attempts → move to dead letter queue
```

### UI Components

- [ ] Webhook delivery dashboard (list all deliveries)
- [ ] Filter by status (success, failed, retrying)
- [ ] View payload/response
- [ ] Manual retry button
- [ ] Test webhook tool

### Implementation

1. Create retry queue processor
2. Implement exponential backoff
3. Add dead letter queue
4. Build delivery dashboard UI
5. Create test webhook tool

### Testing

- [ ] Failed webhook retries automatically
- [ ] Retry count increments
- [ ] Exponential backoff timing correct
- [ ] Dead letter queue captures failures
- [ ] Manual retry works

**Effort**: 6-8h

---

## FEATURE 15: API RATE LIMITING / QUOTA SYSTEM

### Requirements

- [ ] Limit API calls per key per day/hour
- [ ] Show quota usage in settings
- [ ] Alert when approaching limit
- [ ] Configurable limits per plan tier
- [ ] Whitelist IPs (optional)

### Database Schema

```typescript
// Enhance BiApiKeys collection:
BiApiKeys: {
  organisationId: reference,
  name: string,
  key: string, // Encrypted
  secret: string, // Encrypted
  quotaLimitPerDay: number,
  quotaLimitPerHour: number,
  quotaResetAt: date,
  allowedIps?: string[], // Optional IP whitelist
  enabled: boolean,
  lastUsedAt?: date,
  createdAt: date,
}

// New collection for tracking:
ApiQuotaUsage: {
  apiKeyId: reference,
  date: date, // Day
  callsToday: number,
  callsThisHour: number,
  lastResetAt: date,
}
```

### Quota Tiers

```
Free Tier: 100 calls/day, 10 calls/hour
Pro Tier: 10,000 calls/day, 500 calls/hour
Enterprise: Unlimited
```

### Implementation

1. Create quota middleware for API routes
2. Track calls in ApiQuotaUsage
3. Check limits before processing request
4. Return 429 (Too Many Requests) when exceeded
5. Add quota info to response headers

### Response Headers

```
X-RateLimit-Limit: 10000
X-RateLimit-Remaining: 9999
X-RateLimit-Reset: 1694812800
X-RateLimit-Retry-After: 60
```

### Testing

- [ ] Track API calls correctly
- [ ] Reject call when limit exceeded
- [ ] Quota resets at correct time
- [ ] IP whitelist works
- [ ] Headers accurate

**Effort**: 6-8h

---

## FEATURE 16: NO-CODE AUTOMATION BUILDER

### Requirements

- [ ] Create "if X then Y" rules without coding
- [ ] Trigger types: datapoint status change, report generated, schedule
- [ ] Action types: send notification, update datapoint, trigger webhook
- [ ] Visual workflow builder (drag-drop)
- [ ] Test automation before saving

### Database Schema

```typescript
Automations: {
  organisationId: reference,
  name: string, // "Auto-approve Scope1"
  enabled: boolean,

  triggers: [{
    type: 'datapoint_status_changed' | 'report_generated' | 'schedule' | 'webhook',
    condition: {
      metric: string, // 'scope1_emissions'
      operator: 'gt' | 'lt' | 'eq',
      value: number,
      status?: 'pending' | 'approved',
    },
    cronExpression?: string, // For schedule trigger
  }],

  actions: [{
    type: 'notify' | 'update_datapoint' | 'trigger_webhook' | 'send_email',
    payload: {
      notificationMessage?: string,
      fieldToUpdate?: string,
      newValue?: any,
      webhookUrl?: string,
      emailAddress?: string,
    },
  }],

  createdAt: date,
  createdBy: userId,
}
```

### Automation Examples

```
1. "Auto-Approve Small Updates"
   IF: Datapoint change < 5% from previous
   THEN: Auto-approve

2. "Alert on Spike"
   IF: Scope1 > 20% above baseline
   THEN: Send notification + Slack message

3. "Weekly Report"
   IF: Every Monday 9 AM
   THEN: Generate CSRD report + email to team

4. "Webhook Forward"
   IF: Datapoint status = approved
   THEN: POST to external webhook
```

### Automation Builder UI

```
Step 1: Choose Trigger
  - Dropdown: Datapoint change, Report ready, Schedule
  - Configure condition (if applicable)

Step 2: Choose Action(s)
  - Dropdown: Notify, Update, Webhook, Email
  - Configure action details

Step 3: Test & Save
  - Test button (run on sample data)
  - Save automation
```

### Implementation

1. Create AutomationEngine service
2. Build trigger listeners (watch for events)
3. Evaluate conditions
4. Execute actions
5. Build automation builder UI
6. Create test tool

### Testing

- [ ] Create automation successfully
- [ ] Trigger fires on event
- [ ] Condition evaluation correct
- [ ] Action executes
- [ ] Test tool works
- [ ] Disable automation stops it

**Effort**: 12-16h

---

## SPRINT 4 SUMMARY

| Feature             | Effort     |
| ------------------- | ---------- |
| Slack Integration   | 8-10h      |
| Webhook Retry Logic | 6-8h       |
| API Rate Limiting   | 6-8h       |
| No-Code Automation  | 12-16h     |
| **TOTAL**           | **32-42h** |

## Success Criteria

- [ ] Slack notifications working
- [ ] Webhooks retry correctly
- [ ] Rate limiting enforced
- [ ] Automations execute on schedule
- [ ] All tests passing

---

## CURSOR NOTES

- Slack requires OAuth setup (not in code)
- Webhook retry needs background job processor
- Rate limiting is middleware (apply to all API routes)
- Automation builder is most complex → plan UI carefully
