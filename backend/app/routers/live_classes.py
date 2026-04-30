from typing import List
from collections import defaultdict
import asyncio
import json
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status, Query, WebSocket, WebSocketDisconnect
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app import schemas
from app.dependencies import get_current_active_user, get_db, get_tenant, require_roles
from app.models import User
from app.schemas.live_class import (
    LiveClassCreate,
    LiveClassCreateRequest,
    LiveClassDetailRead,
    LiveClassForStudentRead,
    LiveClassRead,
    LiveClassUpdate,
    LiveClassUpdateRequest,
    LiveSessionProvider,
)
from app.services import live_classes as live_class_service
from app.services import auth as auth_service

router = APIRouter()

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        # class_id -> list of (websocket, user_type, user_name)
        self.active_connections: dict[int, list[tuple[WebSocket, str, str]]] = defaultdict(list)

    async def connect(self, websocket: WebSocket, class_id: int, user_type: str, user_name: str = ''):
        await websocket.accept()
        self.active_connections[class_id].append((websocket, user_type, user_name))

    def disconnect(self, websocket: WebSocket, class_id: int):
        if class_id in self.active_connections:
            self.active_connections[class_id] = [
                (ws, ut, un) for ws, ut, un in self.active_connections[class_id] if ws != websocket
            ]
            if not self.active_connections[class_id]:
                del self.active_connections[class_id]

    async def broadcast_to_students(self, class_id: int, message: dict):
        """Broadcast message to all students in the class"""
        if class_id in self.active_connections:
            for websocket, user_type, _ in list(self.active_connections[class_id]):
                if user_type == "student":
                    try:
                        await websocket.send_json(message)
                    except Exception:
                        # Remove broken connections
                        self.disconnect(websocket, class_id)

    async def broadcast_student_list(self, class_id: int):
        """Send the current connected student list to all instructors."""
        if class_id not in self.active_connections:
            return

        student_names = [user_name for _, user_type, user_name in self.active_connections[class_id] if user_type == "student"]
        message = {
            "type": "student_list",
            "students": student_names,
            "count": len(student_names),
        }

        for websocket, user_type, _ in list(self.active_connections[class_id]):
            if user_type == "instructor":
                try:
                    await websocket.send_json(message)
                except Exception:
                    self.disconnect(websocket, class_id)

manager = ConnectionManager()


@router.websocket("/ws/{class_id}")
async def live_class_websocket(
    websocket: WebSocket,
    class_id: int,
    token: str = Query(...),
    tenant_id: str | None = Query(None, alias="x-tenant-id"),
    tenant_id_alias: str | None = Query(None, alias="tenant_id"),
    db: Session = Depends(get_db),
):
    """WebSocket endpoint for live class streaming"""
    print(f"WebSocket connection attempt for class_id: {class_id}")
    print(f"Token received: {token[:20]}..." if token and len(token) > 20 else f"Token: {token}")
    print(f"Tenant ID from query: {tenant_id}, alias: {tenant_id_alias}")
    
    try:
        # Verify user authentication
        from app.core.security import decode_token
        payload = decode_token(token)
        print(f"Token payload: {payload}")
        
        if payload.get("type") != "access":
            await websocket.close(code=4001, reason="Invalid token type")
            return

        current_user = auth_service.get_user_by_token_payload(db, payload)
        if not current_user:
            await websocket.close(code=4001, reason="Invalid token")
            return

        print(f"User authenticated: {current_user.email}, org_id: {current_user.organization_id}")

        # Determine tenant / organization from query params or token payload
        resolved_tenant_id = tenant_id or tenant_id_alias or str(payload.get("tenant_id")) if payload.get("tenant_id") else None
        print(f"Resolved tenant ID: {resolved_tenant_id}")
        
        if not resolved_tenant_id:
            await websocket.close(code=4002, reason="Missing tenant information")
            return

        organization = auth_service.get_organization_by_tenant(db, resolved_tenant_id)
        if not organization:
            await websocket.close(code=4002, reason="Organization not found")
            return
            
        if current_user.organization_id != organization.id:
            await websocket.close(code=4002, reason="Organization access denied")
            return

        # Verify live class exists
        live_class = live_class_service.get_live_class_by_id(db, class_id, organization.id)
        if not live_class:
            await websocket.close(code=4003, reason="Live class not found")
            return

        # Determine user type
        user_type = "instructor" if live_class.instructor_id == current_user.id else "student"
        user_name = current_user.full_name or current_user.email or "Unknown Student"
        
        print(f"User type: {user_type}, class: {live_class.title}")

        # Connect to WebSocket and notify instructors of student join/leave
        await manager.connect(websocket, class_id, user_type, user_name)
        await manager.broadcast_student_list(class_id)
        
        print(f"WebSocket connected successfully for {user_type}")

        try:
            # Keep the connection alive - handle messages and timeouts gracefully
            while True:
                try:
                    # Use receive_json instead of receive_text for structured messages
                    data = await websocket.receive_json()
                    
                    # Handle instructor sending video chunks
                    if user_type == "instructor" and data.get("type") == "video_chunk":
                        # Broadcast video chunk to all students in this class
                        await manager.broadcast_to_students(class_id, {
                            "type": "video_chunk",
                            "data": data.get("data"),
                            "timestamp": data.get("timestamp")
                        })
                        
                except asyncio.TimeoutError:
                    # Send a ping to keep the connection alive
                    try:
                        await websocket.send_json({"type": "ping"})
                    except:
                        break
                except WebSocketDisconnect:
                    # Normal disconnect
                    break
                except Exception as e:
                    # Log but don't break the connection for other errors
                    print(f"WebSocket message handling error: {e}")
                    continue

        except WebSocketDisconnect:
            print(f"WebSocket disconnected for class_id: {class_id}")
        except Exception as e:
            print(f"WebSocket error in message loop: {e}")
        finally:
            manager.disconnect(websocket, class_id)
            try:
                await manager.broadcast_student_list(class_id)
            except:
                pass

    except Exception as e:
        print(f"WebSocket error: {e}")
        import traceback
        traceback.print_exc()
        try:
            await websocket.close(code=4000, reason=str(e))
        except:
            pass


@router.get("/", response_model=List[LiveClassRead])
def list_live_classes(
    course_name: str | None = Query(None),
    instructor_id: int | None = Query(None),
    upcoming_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List live classes. Can filter by course or instructor."""
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")
    
    if course_name:
        return live_class_service.get_course_live_classes(
            db,
            course_name=course_name,
            organization_id=organization.id,
            limit=limit,
            offset=offset,
            upcoming_only=upcoming_only,
        )
    elif instructor_id:
        return live_class_service.get_instructor_live_classes(
            db,
            instructor_id=instructor_id,
            organization_id=organization.id,
            limit=limit,
            offset=offset,
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either course_name or instructor_id must be provided.",
        )


@router.get("/student/upcoming", response_model=List[LiveClassForStudentRead])
def list_student_live_classes(
    upcoming_only: bool = Query(True),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List live classes for the current student's enrolled courses."""
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")
    
    live_classes = live_class_service.get_student_live_classes(
        db,
        student_id=current_user.id,
        organization_id=organization.id,
        upcoming_only=upcoming_only,
        limit=limit,
        offset=offset,
    )
    
    # Add is_ongoing and is_past flags
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    
    result = []
    for lc in live_classes:
        if lc.duration_minutes is None:
            is_ongoing = lc.scheduled_at <= now
        else:
            end_time = lc.scheduled_at + timedelta(minutes=lc.duration_minutes)
            is_ongoing = lc.scheduled_at <= now < end_time

        lc_dict = {
            "id": lc.id,
            "title": lc.title,
            "description": lc.description,
            "scheduled_at": lc.scheduled_at,
            "duration_minutes": lc.duration_minutes,
            "provider": lc.provider,
            "provider_join_url": lc.provider_join_url,
            "instructor": {
                "id": lc.instructor.id,
                "email": lc.instructor.email,
                "full_name": lc.instructor.full_name,
            } if lc.instructor else None,
            "is_ongoing": is_ongoing,
            "is_past": lc.scheduled_at < now,
        }
        result.append(lc_dict)
    
    return result


@router.get("/{live_class_id}", response_model=LiveClassDetailRead)
def get_live_class(
    live_class_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get details of a specific live class."""
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")
    
    live_class = live_class_service.get_live_class_by_id(db, live_class_id, organization.id)
    if not live_class:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Live class not found.")
    
    return live_class


@router.post("/", response_model=LiveClassRead)
def create_live_class(
    data: LiveClassCreateRequest,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin")),
):
    """Create a new live class."""
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")

    try:
        # Debugging logs
        print("Incoming request body:", data.model_dump())
        print("Parsed start_time:", data.start_time)
        print("course_id from query parameters:", "N/A (removed)")

        request_data = data.model_dump(exclude_none=True)
        print(f"Live class create request: data={request_data}")

        # Map request fields to model fields
        mapped_data = {
            'title': request_data.get('title'),
            'description': request_data.get('description'),
            'course_name': request_data.get('course_name'),
            'scheduled_at': request_data.get('start_time'),
            'duration_minutes': request_data.get('duration'),
            'provider': LiveSessionProvider.manual,
            'provider_join_url': None,
        }

        live_class_data = LiveClassCreate(**mapped_data)
        live_class = live_class_service.create_live_class(
            db,
            course_name=request_data.get('course_name'),
            instructor_id=current_user.id,
            organization_id=organization.id,
            data=live_class_data,
        )
        return live_class
    except ValidationError as exc:
        print("Validation error creating live class:", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Invalid live class input.",
                "errors": exc.errors(),
            },
        ) from exc
    except ValueError as exc:
        print("Value error creating live class:", exc)
        detail = str(exc)
        status_code = status.HTTP_404_NOT_FOUND if "not found" in detail else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=detail) from exc
    except RuntimeError as exc:
        print("Runtime error creating live class:", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while creating live class. Please try again later.",
        ) from exc
    except SQLAlchemyError as exc:
        print("Database error creating live class:", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while creating live class. Please try again later.",
        ) from exc
    except Exception as exc:
        print("Unexpected error creating live class:", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while creating the live class.",
        ) from exc


@router.patch("/{live_class_id}", response_model=LiveClassRead)
def update_live_class(
    live_class_id: int,
    data: LiveClassUpdateRequest,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Update a live class (instructor who created it only)."""
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")
    
    live_class = live_class_service.get_live_class_by_id(db, live_class_id, organization.id)
    if not live_class:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Live class not found.")
    
    if live_class.instructor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own live classes.",
        )

    request_data = data.dict(exclude_none=True)
    mapped_data = {}
    if 'title' in request_data:
        mapped_data['title'] = request_data['title']
    if 'description' in request_data:
        mapped_data['description'] = request_data['description']
    if 'start_time' in request_data:
        mapped_data['scheduled_at'] = request_data['start_time']
    if 'duration' in request_data:
        mapped_data['duration_minutes'] = request_data['duration']
    if 'provider_join_url' in request_data:
        mapped_data['provider_join_url'] = request_data['provider_join_url']

    try:
        update_data = LiveClassUpdate(**mapped_data)
        live_class = live_class_service.update_live_class(db, live_class_id, organization.id, update_data)
        return live_class
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=exc.errors()) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete("/{live_class_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_live_class(
    live_class_id: int,
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Delete a live class (instructor who created it only)."""
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")
    
    live_class = live_class_service.get_live_class_by_id(db, live_class_id, organization.id)
    if not live_class:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Live class not found.")
    
    if live_class.instructor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own live classes.",
        )
    
    try:
        live_class_service.delete_live_class(db, live_class_id, organization.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/{live_class_id}/attendance", response_model=schemas.DashboardNotificationItem)
def mark_attendance(
    live_class_id: int,
    status: str = "present",
    tenant_id: str = Depends(get_tenant),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Mark attendance for a live class."""
    organization = auth_service.get_organization_by_tenant(db, tenant_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    if current_user.organization_id != organization.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch.")
    
    live_class = live_class_service.get_live_class_by_id(db, live_class_id, organization.id)
    if not live_class:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Live class not found.")
    
    try:
        attendance = live_class_service.mark_attendance(
            db,
            live_class_id=live_class_id,
            user_id=current_user.id,
            organization_id=organization.id,
            status=status,
        )
        # Return a dummy notification response
        return {
            "id": attendance.id,
            "title": "Attendance Marked",
            "message": f"Attendance marked as {status}",
            "status": "read",
            "channel": "in_app",
            "created_at": attendance.created_at,
        }
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
