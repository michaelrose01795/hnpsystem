## Job Status Snapshot (Stage 1)

This document describes the snapshot contract and how to manually verify the Stage 1 read-only sidebar refactor.

### API Endpoint

`GET /api/status/snapshot`

Accepts:
- `jobId` (numeric id or job number string)
- `jobNumber` (job number string)

Returns:
- `success: boolean`
- `snapshot: object` (see contract below)

### Snapshot Contract

```json
{
  "job": {
    "id": 123,
    "jobNumber": "HNP-00001",
    "reg": "AB12CDE",
    "status": "In Progress",
    "waitingStatus": "Awaiting Workshop",
    "updatedAt": "2024-01-01T12:00:00.000Z",
    "updatedBy": "42"
  },
  "workflows": {
    "vhc": {
      "required": true,
      "status": "completed",
      "completedAt": "2024-01-01T10:00:00.000Z",
      "sentAt": "2024-01-01T10:30:00.000Z",
      "authorisedAt": "2024-01-01T11:00:00.000Z",
      "declinedAt": null
    },
    "invoice": {
      "status": "Draft",
      "invoiceId": "uuid",
      "invoicedAt": "2024-01-01T11:30:00.000Z"
    },
    "parts": {
      "status": "blocked",
      "blocking": true,
      "summary": {
        "totalItems": 2,
        "waiting": 1,
        "onOrder": 1,
        "prePicked": 0,
        "ready": 0
      }
    },
    "bookingRequest": {
      "status": "pending",
      "lastUpdatedAt": "2024-01-01T09:00:00.000Z"
    },
    "tracking": {
      "vehicleStatus": "Ready For Collection",
      "keyStatus": "Keys hung in completed section",
      "lastEventAt": "2024-01-01T11:45:00.000Z"
    },
    "writeUp": {
      "status": "complete",
      "updatedAt": "2024-01-01T11:15:00.000Z"
    },
    "clocking": {
      "active": true,
      "activeTechUserId": "7",
      "startedAt": "2024-01-01T09:30:00.000Z"
    }
  },
  "timeline": [
    {
      "id": "123",
      "at": "2024-01-01T12:00:00.000Z",
      "actorId": "42",
      "actorName": "Jane Doe",
      "type": "status_change",
      "from": "Checked In",
      "to": "In Progress",
      "metadata": {}
    }
  ],
  "blockingReasons": [
    {
      "code": "VHC_INCOMPLETE",
      "message": "Vehicle health check is required before the job can progress.",
      "workflowKey": "vhc"
    }
  ]
}
```

### Manual Verification (Stage 1)

1) Open the dev snapshot page: `/dev/status-snapshot`.
2) Enter a known job number or id and click "Fetch Snapshot".
3) Verify the JSON output matches the job data in Supabase (status, VHC timestamps, invoice, parts, etc.).
4) Open any job card and ensure the right-side Status Sidebar renders a timeline and total time without errors.
5) Trigger a sidebar refresh (navigate between jobs or use existing refresh hooks) and confirm it re-fetches the snapshot.
