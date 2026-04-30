# Live Classes API - Developer Quick Reference

## Base URL
```
http://localhost:8000/api/v1/live-classes
```

## Authentication
All endpoints require:
- JWT Bearer token in `Authorization` header
- `x-tenant-id` header with organization tenant ID

## Endpoints

### 1. List Live Classes by Course or Instructor
```http
GET /live-classes?course_id=1&limit=50&offset=0&upcoming_only=false
GET /live-classes?instructor_id=5&limit=50&offset=0
```

**Query Parameters:**
- `course_id` (optional): Filter by course
- `instructor_id` (optional): Filter by instructor
- `upcoming_only` (optional, default=false): Show only future classes
- `limit` (optional, default=50): Pagination limit
- `offset` (optional, default=0): Pagination offset

**Response:**
```json
[
  {
    "id": 1,
    "course_id": 1,
    "title": "Advanced React Patterns",
    "description": "Deep dive into React patterns...",
    "scheduled_at": "2026-04-20T14:00:00+00:00",
    "duration_minutes": 60,
    "instructor_id": 5,
    "provider": "zoom",
    "provider_join_url": "https://zoom.us/...",
    "provider_meeting_id": null,
    "is_recurring": false,
    "created_at": "2026-04-13T10:30:00+00:00",
    "updated_at": "2026-04-13T10:30:00+00:00",
    "instructor": {
      "id": 5,
      "email": "instructor@lms.com",
      "full_name": "John Instructor"
    }
  }
]
```

### 2. Get Student's Upcoming Live Classes
```http
GET /live-classes/student/upcoming?upcoming_only=true&limit=50&offset=0
```

**Response:**
```json
[
  {
    "id": 1,
    "course_id": 1,
    "title": "Advanced React Patterns",
    "description": "...",
    "scheduled_at": "2026-04-20T14:00:00+00:00",
    "duration_minutes": 60,
    "provider": "zoom",
    "provider_join_url": "https://zoom.us/...",
    "instructor": { ... },
    "is_ongoing": false,
    "is_past": false
  }
]
```

### 3. Get Live Class Details
```http
GET /live-classes/1
```

**Response:**
```json
{
  "id": 1,
  "course_id": 1,
  "title": "Advanced React Patterns",
  "description": "...",
  "scheduled_at": "2026-04-20T14:00:00+00:00",
  "duration_minutes": 60,
  "instructor_id": 5,
  "provider": "zoom",
  "provider_join_url": "https://zoom.us/...",
  "provider_meeting_id": null,
  "is_recurring": false,
  "created_at": "2026-04-13T10:30:00+00:00",
  "updated_at": "2026-04-13T10:30:00+00:00",
  "instructor": { ... },
  "attendances": [
    {
      "id": 1,
      "user_id": 10,
      "attended_at": "2026-04-20T14:05:00+00:00",
      "status": "present",
      "user": { ... }
    }
  ],
  "recordings": []
}
```

### 4. Create Live Class
```http
POST /live-classes?course_id=1
Content-Type: application/json

{
  "title": "Advanced React Patterns",
  "description": "Deep dive into React patterns",
  "scheduled_at": "2026-04-20T14:00:00Z",
  "duration_minutes": 60,
  "provider": "zoom",
  "provider_join_url": "https://zoom.us/j/123456789"
}
```

**Request Body:**
```json
{
  "title": "string (required, max 255 chars)",
  "description": "string (optional)",
  "scheduled_at": "datetime (required, ISO 8601)",
  "duration_minutes": "integer (optional, 5-480 min)",
  "provider": "enum: zoom|google_meet|microsoft_teams|manual",
  "provider_join_url": "string (optional, max 512 chars)"
}
```

**Response:** 201 Created + LiveClassRead schema

**Automatic Actions:**
- Creates notifications for all enrolled students
- Notification message: "New live class scheduled: {title} on {date}"

### 5. Update Live Class
```http
PATCH /live-classes/1
Content-Type: application/json

{
  "title": "Updated Title",
  "scheduled_at": "2026-04-21T15:00:00Z",
  "provider_join_url": "https://zoom.us/j/987654321"
}
```

**Notes:**
- Only the instructor who created the class can update it
- All fields are optional

**Response:** 200 OK + LiveClassRead schema

### 6. Delete Live Class
```http
DELETE /live-classes/1
```

**Notes:**
- Only the instructor who created the class can delete it
- Uses soft delete (record not actually removed)

**Response:** 204 No Content

### 7. Mark Attendance
```http
POST /live-classes/1/attendance?status=present
```

**Query Parameters:**
- `status` (optional, default="present"): Attendance status

**Response:** 200 OK

## Platform Values

| Platform | Value | Description |
|----------|-------|-------------|
| Zoom | `zoom` | Zoom meeting |
| Google Meet | `google_meet` | Google Meet |
| Microsoft Teams | `microsoft_teams` | Microsoft Teams |
| Manual | `manual` | Custom/manual link |

## Error Responses

### 400 Bad Request
```json
{
  "detail": "Either course_id or instructor_id must be provided."
}
```

### 401 Unauthorized
```json
{
  "detail": "Not authenticated"
}
```

### 403 Forbidden
```json
{
  "detail": "Only instructors can create live classes."
}
```

### 404 Not Found
```json
{
  "detail": "Live class not found."
}
```

## Usage Examples

### Frontend - Create Live Class
```typescript
import { createLiveClass } from '@/services/live_classes';

const payload = {
  title: "Advanced JavaScript",
  description: "Deep dive into async/await",
  scheduled_at: new Date("2026-04-20T14:00:00Z").toISOString(),
  duration_minutes: 90,
  provider: "zoom",
  provider_join_url: "https://zoom.us/j/123456789"
};

try {
  const liveClass = await createLiveClass(1, payload);
  console.log('Created:', liveClass);
} catch (error) {
  console.error('Error:', error.message);
}
```

### Frontend - Join Live Class
```typescript
import { getStudentLiveClasses, markAttendance } from '@/services/live_classes';

// Get upcoming classes
const classes = await getStudentLiveClasses(true);

// Join a class
const liveClass = classes[0];
await markAttendance(liveClass.id);
window.open(liveClass.provider_join_url, '_blank');
```

### Frontend - List Instructor's Classes
```typescript
import { listLiveClasses } from '@/services/live_classes';

const classes = await listLiveClasses(undefined, 5); // instructorId=5
classes.forEach(lc => {
  console.log(`${lc.title} - ${lc.provider}`);
});
```

### Backend - Query Live Classes
```python
from app.services import live_classes as live_class_service
from sqlalchemy.orm import Session

# Get all upcoming classes for a course
classes = live_class_service.get_course_live_classes(
    db=session,
    course_id=1,
    organization_id=1,
    upcoming_only=True
)

# Get attendees
attendees = live_class_service.get_live_class_attendees(
    db=session,
    live_class_id=1,
    organization_id=1
)
```

## Webhooks/Events (Future)

The following events are planned:
- `live_class.scheduled` - When a new live class is created
- `live_class.started` - When a live class begins
- `live_class.ended` - When a live class ends
- `live_class.recording_ready` - When recording is available
- `student.joined` - When a student joins

## Rate Limiting

Current rate limits (subject to change):
- 100 requests per minute for authenticated users
- 10 requests per minute for unauthenticated users

## Pagination

Default and maximum limits:
- Default limit: 50 items
- Maximum limit: 100 items

Use `limit` and `offset` for pagination:
```
GET /live-classes?course_id=1&limit=25&offset=0
GET /live-classes?course_id=1&limit=25&offset=25
```

## Filtering and Sorting

Current filters:
- `course_id` - Filter by course
- `instructor_id` - Filter by instructor
- `upcoming_only` - Show only future classes

Default sorting: `scheduled_at DESC` (newest first)

## Testing with cURL

```bash
# List live classes
curl -X GET "http://localhost:8000/api/v1/live-classes?course_id=1" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-tenant-id: YOUR_TENANT_ID"

# Create live class
curl -X POST "http://localhost:8000/api/v1/live-classes?course_id=1" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-tenant-id: YOUR_TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My Live Class",
    "scheduled_at": "2026-04-20T14:00:00Z",
    "duration_minutes": 60,
    "provider": "zoom",
    "provider_join_url": "https://zoom.us/j/123456789"
  }'

# Mark attendance
curl -X POST "http://localhost:8000/api/v1/live-classes/1/attendance?status=present" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-tenant-id: YOUR_TENANT_ID"
```

## Troubleshooting

### Issue: "Only instructors can create live classes"
- Ensure the user has the "instructor" role
- Check that the JWT token is not expired
- Verify the user is in the correct organization

### Issue: "Live class not found"
- Verify the live_class_id is correct
- Check that the class has not been deleted
- Ensure you're in the correct organization

### Issue: "Organization mismatch"
- Verify the x-tenant-id header matches the user's organization
- Check JWT token payload for correct tenant_id

### Issue: "Either course_id or instructor_id must be provided"
- When listing, provide either `course_id` or `instructor_id` query parameter
- Both cannot be missing

---

**Last Updated:** April 13, 2026
**API Version:** v1
**Status:** Stable
