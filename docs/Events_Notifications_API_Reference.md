# Events & Notifications API — Backend Reference

All endpoints are prefixed with `/api/admin`. Events are scoped to a term. Notifications are configured per event and can be sent immediately or scheduled.

---

## Data Types

### Event
```json
{
  "id": "string",
  "termId": "string",
  "name": "string",
  "date": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD | null",
  "type": "holiday | exam | event",
  "notificationConfigId": "string | null",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

### NotificationConfig
```json
{
  "id": "string",
  "eventId": "string",
  "targets": {
    "roles":    [ "string" ],   // e.g. ["teacher", "parent"]
    "classIds": [ "string" ],   // UUIDs — empty = all classes
    "userIds":  [ "string" ]    // UUIDs — for direct targeting
  },
  "channels": [ "push | sms | email | in_app" ],
  "schedule": {
    "type": "immediate | scheduled",
    "sendAt": "ISO8601 | null"  // required when type = "scheduled"
  },
  "status": "draft | scheduled | processing | sent | failed"
}
```

### NotificationLog
```json
{
  "id": "string",
  "eventId": "string",
  "recipientId": "string",
  "recipientName": "string",
  "channel": "push | sms | email | in_app",
  "status": "sent | failed | pending",
  "sentAt": "ISO8601 | null",
  "errorMessage": "string | null"
}
```

---

## Endpoints

---

### 1. Get Events

**`GET /api/admin/events`**

Returns all events for a given term.

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| `termId` | string (UUID) | ✅ | Filter events by term |

**Example Request**
```
GET /api/admin/events?termId=e4df07a0-ebb3-401b-8f09-4d78f0717d2b
```

**Success Response `200`**
```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "string",
        "termId": "string",
        "name": "string",
        "date": "YYYY-MM-DD",
        "endDate": "YYYY-MM-DD | null",
        "type": "holiday | exam | event",
        "notificationConfigId": "string | null",
        "createdAt": "ISO8601",
        "updatedAt": "ISO8601"
      }
    ]
  }
}
```

> Return `"events": []` when no events exist for the term. Do not return an error.

---

### 2. Create Event

**`POST /api/admin/events`**

Creates a new event under a term. If a notification config is included in the payload, create and link a `NotificationConfig` record and return its ID.

**Request Body**

```json
{
  "termId": "string",
  "name": "string",
  "date": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD | null",
  "type": "holiday | exam | event",
  "notifications": {
    "enabled": "boolean",
    "targets": {
      "roles":    [ "string" ],
      "classIds": [ "string" ],
      "userIds":  [ "string" ]
    },
    "channels": [ "push | sms | email | in_app" ],
    "schedule": {
      "type": "immediate | scheduled",
      "sendAt": "ISO8601 | null"
    }
  }
}
```

**Example Request**
```json
{
  "termId": "e4df07a0-ebb3-401b-8f09-4d78f0717d2b",
  "name": "Mid-Term Break",
  "date": "2025-03-10",
  "endDate": "2025-03-14",
  "type": "holiday",
  "notifications": {
    "enabled": true,
    "targets": {
      "roles": ["teacher", "parent"],
      "classIds": [],
      "userIds": []
    },
    "channels": ["push", "sms"],
    "schedule": {
      "type": "scheduled",
      "sendAt": "2025-03-07T08:00:00.000Z"
    }
  }
}
```

**Success Response `201`**
```json
{
  "success": true,
  "data": {
    "event": {
      "id": "string",
      "termId": "string",
      "name": "string",
      "date": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD | null",
      "type": "holiday | exam | event",
      "notificationConfigId": "string | null",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  }
}
```

> If `notifications.enabled` is `false` or `notifications` is omitted, set `notificationConfigId` to `null`. If `notifications.enabled` is `true`, create the `NotificationConfig` record and return its `id` as `notificationConfigId`.

---

### 3. Update Event

**`PUT /api/admin/events/:eventId`**

Updates an existing event. If a notification config is included, upsert the linked `NotificationConfig` record.

**URL Params**

| Param | Type | Required | Description |
|---|---|---|---|
| `eventId` | string (UUID) | ✅ | Event to update |

**Request Body**

Same shape as Create Event body, all fields optional except those being changed.

**Example Request**
```json
{
  "name": "Mid-Term Break (Updated)",
  "endDate": "2025-03-15",
  "notifications": {
    "enabled": true,
    "channels": ["push", "email"],
    "schedule": {
      "type": "immediate"
    }
  }
}
```

**Success Response `200`**
```json
{
  "success": true,
  "data": {
    "event": {
      "id": "string",
      "termId": "string",
      "name": "string",
      "date": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD | null",
      "type": "holiday | exam | event",
      "notificationConfigId": "string | null",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  }
}
```

> If `notifications.enabled` changes from `true` to `false`, set `notificationConfigId` to `null` and cancel any pending scheduled notification jobs for this event.

---

### 4. Delete Event

**`DELETE /api/admin/events/:eventId`**

Deletes an event and its associated notification config and logs.

**URL Params**

| Param | Type | Required | Description |
|---|---|---|---|
| `eventId` | string (UUID) | ✅ | Event to delete |

**Example Request**
```
DELETE /api/admin/events/abc123
```

**Success Response `200`**
```json
{
  "success": true
}
```

> Cascade delete the linked `NotificationConfig` and all `NotificationLog` records for this event. Cancel any pending scheduled notification jobs. Return `success: true` even if the event did not exist (idempotent).

---

### 5. Update Event Notification Settings

**`PUT /api/admin/events/:eventId/notifications`**

Creates or updates the notification configuration for an event. This is the dedicated endpoint for managing notification settings independently of the event itself.

**URL Params**

| Param | Type | Required | Description |
|---|---|---|---|
| `eventId` | string (UUID) | ✅ | Parent event |

**Request Body**

```json
{
  "targets": {
    "roles":    [ "string" ],
    "classIds": [ "string" ],
    "userIds":  [ "string" ]
  },
  "channels": [ "push | sms | email | in_app" ],
  "schedule": {
    "type": "immediate | scheduled",
    "sendAt": "ISO8601 | null"
  }
}
```

**Example Request**
```json
{
  "targets": {
    "roles": ["teacher", "parent", "student"],
    "classIds": ["97fdee7a-428f-42d4-b503-51ed3260c08e"],
    "userIds": []
  },
  "channels": ["push", "in_app"],
  "schedule": {
    "type": "scheduled",
    "sendAt": "2025-03-07T08:00:00.000Z"
  }
}
```

**Success Response `200`**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "status": "scheduled | processing"
  }
}
```

> Return `"status": "scheduled"` when `schedule.type` is `"scheduled"`. Return `"status": "processing"` when `schedule.type` is `"immediate"` (job is queued immediately). Update `notificationConfigId` on the parent event record to point to this config.

---

### 6. Get Event Notification Config

**`GET /api/admin/events/:eventId/notifications`**

Fetches the current notification configuration for an event.

**URL Params**

| Param | Type | Required | Description |
|---|---|---|---|
| `eventId` | string (UUID) | ✅ | Parent event |

**Example Request**
```
GET /api/admin/events/abc123/notifications
```

**Success Response `200`**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "eventId": "string",
    "targets": {
      "roles":    [ "string" ],
      "classIds": [ "string" ],
      "userIds":  [ "string" ]
    },
    "channels": [ "push | sms | email | in_app" ],
    "schedule": {
      "type": "immediate | scheduled",
      "sendAt": "ISO8601 | null"
    },
    "status": "draft | scheduled | processing | sent | failed"
  }
}
```

> If no config exists yet for the event, return a default draft config with empty targets, no channels, `schedule.type = "immediate"`, and `status = "draft"` — do not return a 404.

---

### 7. Send Notification Override

**`POST /api/admin/events/:eventId/notify`**

Triggers an immediate notification send for the event, overriding any configured schedule. Used when an admin wants to send right now regardless of the saved schedule setting.

**URL Params**

| Param | Type | Required | Description |
|---|---|---|---|
| `eventId` | string (UUID) | ✅ | Parent event |

**Request Body**

```json
{
  "targets": {
    "roles":    [ "string" ],
    "classIds": [ "string" ],
    "userIds":  [ "string" ]
  },
  "channels": [ "push | sms | email | in_app" ],
  "message": "string | null"
}
```

**Example Request**
```json
{
  "targets": {
    "roles": ["parent", "student"],
    "classIds": [],
    "userIds": []
  },
  "channels": ["push", "sms"],
  "message": "Reminder: Mid-Term Break starts Monday."
}
```

**Success Response `200`**
```json
{
  "success": true,
  "message": "Notification job queued successfully."
}
```

> This should enqueue a background job for immediate dispatch — do not process synchronously. Update the linked `NotificationConfig` status to `"processing"`. Log each dispatch attempt to the `NotificationLog` table.

---

### 8. Get Notification Logs

**`GET /api/admin/notifications/logs`**

Returns delivery logs for notifications sent for a specific event, optionally filtered by delivery status.

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| `eventId` | string (UUID) | ✅ | Filter logs by event |
| `status` | string | ❌ | Filter by status: `sent`, `failed`, `pending` |

**Example Request**
```
GET /api/admin/notifications/logs?eventId=abc123&status=failed
```

**Success Response `200`**
```json
{
  "success": true,
  "data": {
    "total": "number",
    "failed": "number",
    "logs": [
      {
        "id": "string",
        "eventId": "string",
        "recipientId": "string",
        "recipientName": "string",
        "channel": "push | sms | email | in_app",
        "status": "sent | failed | pending",
        "sentAt": "ISO8601 | null",
        "errorMessage": "string | null"
      }
    ]
  }
}
```

> `total` is the count of all logs for the event regardless of the `status` filter. `failed` is always the count of failed logs regardless of filter. Return `"logs": []` when no logs exist — not an error. Logs should be ordered by `sentAt` descending.

---

## Error Responses

All endpoints return errors in this shape:

```json
{
  "success": false,
  "error": {
    "code": "string",
    "message": "string"
  }
}
```

| HTTP Status | When to use |
|---|---|
| `400` | Missing required fields, invalid date format, invalid event type |
| `401` | Unauthenticated request |
| `403` | Insufficient role/permissions |
| `404` | Event not found |
| `500` | Unexpected server error |

---

## Notes for Implementation

- `date` and `endDate` are date-only strings (`YYYY-MM-DD`), not timestamps — do not store as datetime
- `endDate` is nullable — a single-day event has `endDate: null`
- Valid `type` values are strictly `holiday`, `exam`, `event` — reject anything else with a `400`
- Notification jobs must be processed asynchronously via a queue (e.g. BullMQ, Celery) — never block the HTTP response on delivery
- When `schedule.type` is `"scheduled"`, validate that `sendAt` is in the future at the time of saving
- Cancelling a scheduled job (on event delete or notifications disabled) must actually remove the job from the queue, not just update the DB status
- The `targets` object supports layered audience selection — `roles` is broadest, `classIds` narrows by class, `userIds` is for explicit individual targeting; the backend should resolve the final recipient list by union of all three
- Notification logs should be written per recipient per channel — one log row per delivery attempt
