from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings


class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        tenant_id = request.headers.get(settings.tenant_header)
        if tenant_id:
            request.state.tenant_id = tenant_id
        else:
            request.state.tenant_id = None
        response = await call_next(request)
        return response
