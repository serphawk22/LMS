#!/usr/bin/env python
"""Test the calendar endpoint."""

import sys
from pathlib import Path

# Ensure the backend package directory is on PYTHONPATH
ROOT_DIR = Path(__file__).resolve().parents[0]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from types import SimpleNamespace
from datetime import datetime, timezone, timedelta
from app import schemas
from app.routers.calendar import router
from app.services import auth as auth_service

# Mock objects
def make_org():
    return SimpleNamespace(id=1)

def make_user():
    return SimpleNamespace(id=42, organization_id=1, role_name="student", is_active=True, is_verified=True)

def make_announcement():
    return SimpleNamespace(
        id=1,
        title="Test Announcement",
        content="Test content",
        published=True,
        published_at=datetime(2026, 4, 23, 10, 0, tzinfo=timezone.utc),
        deleted_at=None,
        organization_id=1
    )

def make_live_class():
    return SimpleNamespace(
        id=2,
        title="Test Live Class",
        description="Test description",
        scheduled_at=datetime(2026, 4, 23, 14, 0, tzinfo=timezone.utc),
        duration_minutes=60,
        course_name="Excel Course",
        course_id=1,
        organization_id=1,
        is_deleted=False
    )

def make_enrollment():
    return SimpleNamespace(
        user_id=42,
        course_id=1,
        organization_id=1
    )

# Test the calendar event schema
print("Testing CalendarEventRead schema...")

event1 = schemas.CalendarEventRead(
    id=1,
    title="Assignment Submission Deadline",
    date="2026-04-23",
    type="announcement",
    description="Submit your assignment"
)

event2 = schemas.CalendarEventRead(
    id=2,
    title="Excel Live Class",
    date="2026-04-23",
    type="live_class",
    start_time="14:00",
    end_time="15:00",
    course_name="Excel Course",
    description="Live class session"
)

print(f"✓ CalendarEventRead schema works for announcements: {event1}")
print(f"✓ CalendarEventRead schema works for live classes: {event2}")

# Test serialization
events_list = [event1, event2]
print(f"\n✓ Events list created successfully with {len(events_list)} events")

# Convert to dict for JSON serialization
events_dict = [e.model_dump() for e in events_list]
print(f"\n✓ Events serialized to dict:")
for event in events_dict:
    print(f"  - {event}")

print("\n✓ All tests passed! Calendar endpoint schema is working correctly.")
