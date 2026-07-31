# SPRINT 7: MOBILE APP & OFFLINE SYNC (Weeks 13-16)

## iOS/Android App, Offline Data Sync

**Total Effort**: 52-66 hours | **Team**: 3 engineers (frontend, backend, DevOps) | **Dependencies**: All previous sprints

**STATUS**: Build later (after core features complete)

---

## FEATURE 26: MOBILE APP (iOS/Android)

### Requirements

- [ ] Data entry on mobile devices
- [ ] Field workers can log emissions offline
- [ ] Photos/evidence capture
- [ ] Real-time notifications
- [ ] Read-only report viewing

### Technology Stack

```
Framework: React Native OR Flutter
  - React Native: JavaScript, share code with web team
  - Flutter: Dart, better performance, easier animations

Backend: Same Next.js API (already built)
State Management: Redux or Context API
Local Storage: SQLite for offline data
Sync: Background job processor

UI Components Library:
  - React Native Paper (Material Design)
  or
  - Flutter Material Design
```

### Core Screens (20 total)

**Auth & Settings**

- [ ] Login/Sign Up
- [ ] Settings
- [ ] Language selection
- [ ] Offline mode indicator

**Datapoint Entry (Primary)**

- [ ] Datapoint form (metric, value, unit, date)
- [ ] Photo capture (evidence)
- [ ] GPS location tagging
- [ ] Attachments
- [ ] Draft saving

**Viewing & Browsing**

- [ ] Datapoint list (with filters)
- [ ] Report viewer (read-only)
- [ ] Dashboard (key metrics)
- [ ] Supplier list

**Approval Workflow**

- [ ] Pending approvals list
- [ ] Approval form
- [ ] Comments/rejection reasons

**Sync & Offline**

- [ ] Sync status screen
- [ ] Queue of unsent datapoints
- [ ] Retry failed syncs
- [ ] Offline indicator

### Database Schema

```typescript
// SQLite tables (local device storage):

local_datapoints {
  id: string (UUID),
  metric: string,
  value: number,
  unit: string,
  date: date,
  photos: string[], (base64 encoded)
  gps?: { lat, lng },
  status: 'draft' | 'pending_sync' | 'synced',
  syncError?: string,
  createdAt: date,
  lastSyncAt?: date,
}

local_sync_queue {
  id: string,
  datapoints: string[], (UUIDs of datapoints)
  status: 'pending' | 'syncing' | 'failed',
  retryCount: number,
  lastError?: string,
  createdAt: date,
}

local_offline_cache {
  key: string, (report ID, supplier list, etc)
  data: json,
  expiredAt: date, (cache TTL)
}
```

### API Endpoints (New)

```
POST /api/app/mobile/sync
  - Body: { datapoints: [...], force: false }
  - Response: { synced: number, errors: [...] }

GET /api/app/mobile/offline-cache
  - Return reports/data for offline viewing

POST /api/app/mobile/push-tokens
  - Register device for push notifications
```

### Key Features

**Offline Mode**

```
User enters datapoint:
1. Form submission saved to SQLite (immediate)
2. UI shows "Draft - waiting to sync"
3. When online, auto-sync to server
4. Show sync progress (spinning icon)
5. Mark as synced when complete
6. Retry on failure

Large forms:
- Auto-save every field (debounced)
- Restore on app restart
```

**Photo Capture**

```
User taps "Add Photo":
1. Camera opens
2. Photo captured
3. Compressed to base64
4. Embedded in datapoint (SQLite)
5. On sync, upload to server as attachment
6. Show upload progress
```

**Notifications**

```
Push notifications (enabled by default):
- "Datapoint approved"
- "Report ready"
- "Audit complete"

Local notifications (offline):
- "Sync failed, tap to retry"
- "New datapoints ready"
```

**App Permissions**

- Camera (photos)
- Location (optional GPS tag)
- Notifications
- Local storage

### Mobile App Flow

```
1. User logs in (credentials stored securely)
2. Dashboard: Quick stats, recent activity
3. Datapoint creation:
   - Tap "+" button
   - Select metric type
   - Enter value
   - Add photo
   - Save (local)
   - Auto-sync when online
4. Approvals: View pending, approve/reject
5. Reports: View on device (cached)
6. Offline: Everything works, sync when connected
```

### Implementation Plan

1. Setup React Native project (or Flutter)
2. Create auth flow
3. Build datapoint entry screens
4. Integrate camera
5. Implement local SQLite storage
6. Create sync logic
7. Build offline mode
8. Setup push notifications
9. Create dashboard
10. Testing & performance optimization

### Testing

- [ ] Datapoint creation works
- [ ] Offline data persists
- [ ] Sync triggers when online
- [ ] Photos upload correctly
- [ ] Push notifications work
- [ ] Camera permission flow
- [ ] App crash recovery
- [ ] Performance: app launches <3s
- [ ] Battery usage acceptable
- [ ] Network bandwidth optimized

### App Deployment

- [ ] iOS: App Store submission
- [ ] Android: Google Play submission
- [ ] Internal testing via TestFlight (iOS) / Google Play Beta
- [ ] Release notes and documentation

**Effort**: 40-50h

---

## FEATURE 27: OFFLINE SYNC

### Requirements

- [ ] Queue datapoints created offline
- [ ] Auto-sync when connection restored
- [ ] Show sync progress
- [ ] Handle sync errors gracefully
- [ ] Prevent duplicate submissions
- [ ] Conflict resolution (server vs local)

### Sync Architecture

```
Local SQLite (Device)
    ↓
local_sync_queue (tracks what needs syncing)
    ↓
[WiFi/Cellular connected?]
    ↓ YES
Send to /api/app/mobile/sync
    ↓
Server validates & stores
    ↓
Return { synced: [...], errors: [...] }
    ↓
Update local_datapoints status
    ↓ Conflicts?
Use server version as source of truth
    ↓
Update local cache with server data
```

### Sync Queue Implementation

```typescript
class SyncQueue {
  // Add pending datapoint to queue
  enqueue(datapoint: LocalDatapoint);

  // Process queue (run when online)
  async processQueue();

  // Handle sync success
  onSyncSuccess(datapointId);

  // Handle sync error
  onSyncError(datapointId, error);

  // Retry failed syncs
  async retryFailed();

  // Clear sync queue
  clear();
}
```

### Conflict Resolution

```
Scenario: Device submits datapoint while offline
1. Local datapoint created on device
2. Device comes online
3. Server received same datapoint from web UI
4. Conflict detected (same metric, date, value)

Resolution:
- Server version is source of truth
- Local version discarded (show warning to user)
- User notified: "This datapoint was updated on another device"
- Option to review differences
```

### Retry Strategy

```
Failed sync:
- Attempt 1: Immediate retry (if still connected)
- Attempt 2: Wait 30 seconds
- Attempt 3: Wait 2 minutes
- Attempt 4: Wait 10 minutes
- After 5 failures: Show "Sync Failed" button, let user retry manually

Network errors (temporary):
- Retry automatically
- Don't show error to user (transparent)

Validation errors (permanent):
- Show to user with details
- Allow edit and retry
```

### Sync Indicators

```
UI States:
1. Synced ✓
   - Green checkmark
   - "Synced 2 hours ago"

2. Syncing ⟳
   - Spinning icon
   - "Syncing..."

3. Pending (offline)
   - Clock icon
   - "Waiting to sync"

4. Failed ✗
   - Red X icon
   - "Sync failed - tap to retry"
   - Error message on tap
```

### Database Schema (SQLite)

```typescript
sync_operations {
  id: uuid,
  type: 'datapoint' | 'approval' | 'report',
  resourceId: string,
  operation: 'create' | 'update' | 'delete',
  payload: json,
  status: 'pending' | 'syncing' | 'synced' | 'failed',
  retryCount: number,
  lastError?: string,
  createdAt: date,
  syncedAt?: date,
}

sync_metadata {
  lastSyncAt: date,
  pendingCount: number,
  totalSynced: number,
}
```

### API Endpoints

```
POST /api/app/mobile/sync
  - Batch sync all pending datapoints
  - Handles duplicates, conflicts
  - Returns: { synced: number, failed: number, conflicts: [...] }

GET /api/app/mobile/sync-status
  - Returns: { pending: number, lastSyncAt: date, hasErrors: boolean }

POST /api/app/mobile/sync/retry
  - Retry all failed syncs
```

### Implementation

1. Create SyncQueue service (orchestrate syncs)
2. Implement offline detection (NetInfo)
3. Create sync worker (background job)
4. Handle conflicts
5. Implement retry logic
6. Add sync UI indicators

### Testing

- [ ] Datapoint created offline → syncs when online
- [ ] Multiple datapoints queued → all sync
- [ ] Sync failure → retry works
- [ ] Conflicts detected and resolved
- [ ] Sync progress shown to user
- [ ] App doesn't crash during sync
- [ ] Battery impact minimal
- [ ] Network bandwidth efficient
- [ ] Offline cache works correctly
- [ ] Photos sync correctly

**Effort**: 12-16h

---

## SPRINT 7 SUMMARY

| Feature      | Effort     | Status            |
| ------------ | ---------- | ----------------- |
| Mobile App   | 40-50h     | Build in Sprint 7 |
| Offline Sync | 12-16h     | Build in Sprint 7 |
| **TOTAL**    | **52-66h** | **Ready (later)** |

## Success Criteria

- [ ] App published to App Store & Google Play
- [ ] Offline entry works smoothly
- [ ] Sync reliable and efficient
- [ ] Push notifications work
- [ ] Performance acceptable (battery, network, speed)
- [ ] No data loss
- [ ] Conflict resolution working

---

## CURSOR NOTES

- This is complex (separate team recommended)
- Use React Native to share web expertise
- SQLite for offline storage (well-tested)
- Sync logic is critical → test thoroughly
- Build auth first (re-use web auth tokens)
- Test extensively on real devices (not just simulator)
- Performance matters (battery, network, storage)

## Timeline Note

- **Recommended**: Complete Sprints 1-6 first (core web features)
- **Then**: Tackle mobile as separate workstream
- **Parallel**: Can start mobile design/prototyping while web features build
- **Total Project**: ~15-18 weeks (6 weeks core + 4 weeks mobile + buffer)
