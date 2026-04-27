"""
Metered Video API router.
Handles creating/validating Metered meeting rooms for live classes.
"""
import logging
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.config import settings
from app.dependencies import get_current_active_user, require_roles
from app.models import User

logger = logging.getLogger(__name__)
router = APIRouter()


class MeetingRoomResponse(BaseModel):
    roomName: str
    joinUrl: str


class ValidateRoomResponse(BaseModel):
    roomName: str
    isValid: bool


def _metered_base_url() -> str:
    domain = settings.metered_domain
    if not domain or domain == "your-app.metered.live":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Metered domain is not configured. Go to https://dashboard.metered.ca, "
                   "copy your app domain (e.g. myapp.metered.live), and set METERED_DOMAIN in backend/.env.",
        )
    return f"https://{domain}/api/v1"


def _metered_secret() -> str:
    secret = settings.metered_secret_key
    if not secret or secret == "your-metered-secret-key":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Metered secret key is not configured. Go to https://dashboard.metered.ca → Developers tab, "
                   "copy your Secret Key, and set METERED_SECRET_KEY in backend/.env.",
        )
    return secret


@router.post("/create-room", response_model=MeetingRoomResponse)
async def create_meeting_room(
    current_user: User = Depends(require_roles("instructor", "organization_admin", "super_admin")),
) -> Any:
    """
    Create a new Metered meeting room.
    Only instructors and admins can create rooms.
    Returns the room name and a join URL.
    """
    base_url = _metered_base_url()
    secret = _metered_secret()

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{base_url}/room",
                params={"secretKey": secret},
                json={"autoJoin": True}
            )
            response.raise_for_status()
            data = response.json()

        room_name: str = data.get("roomName", "")
        domain = settings.metered_domain
        join_url = f"https://{domain}/{room_name}"

        logger.info(f"Metered room created: {room_name} by user {current_user.email}")
        return MeetingRoomResponse(roomName=room_name, joinUrl=join_url)

    except httpx.HTTPStatusError as exc:
        logger.error(f"Metered API error creating room: {exc.response.text}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Metered API error: {exc.response.text}",
        ) from exc
    except httpx.RequestError as exc:
        logger.error(f"Network error calling Metered API: {exc}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not reach Metered video service. Please try again later.",
        ) from exc


@router.get("/validate-room/{room_name}", response_model=ValidateRoomResponse)
async def validate_meeting_room(
    room_name: str,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Validate that a Metered meeting room exists and is active.
    Any authenticated user can validate a room before joining.
    """
    base_url = _metered_base_url()
    secret = _metered_secret()

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{base_url}/room/{room_name}",
                params={"secretKey": secret},
            )

        if response.status_code == 404:
            return ValidateRoomResponse(roomName=room_name, isValid=False)

        response.raise_for_status()
        data = response.json()

        is_valid = bool(data.get("roomName"))
        logger.info(f"Metered room '{room_name}' validation: {is_valid}")
        return ValidateRoomResponse(roomName=room_name, isValid=is_valid)

    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            return ValidateRoomResponse(roomName=room_name, isValid=False)
        logger.error(f"Metered API error validating room: {exc.response.text}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Metered API error: {exc.response.text}",
        ) from exc
    except httpx.RequestError as exc:
        logger.error(f"Network error calling Metered API: {exc}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not reach Metered video service.",
        ) from exc
