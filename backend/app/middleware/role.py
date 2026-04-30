from typing import Any

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.security import decode_token


class RoleMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Any):
        request.state.user_role = None
        request.state.user_id = None
        request.state.tenant_id = None
        request.state.token_payload = None

        authorization = request.headers.get("Authorization")
        if authorization and authorization.lower().startswith("bearer "):
            token = authorization[7:]
            try:
                payload = decode_token(token)
                request.state.token_payload = payload
                request.state.user_role = payload.get("role")
                request.state.user_id = payload.get("sub")
                request.state.tenant_id = payload.get("tenant_id")
            except ValueError:
                pass

        response = await call_next(request)
        return response
