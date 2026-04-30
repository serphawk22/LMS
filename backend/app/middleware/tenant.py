from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings
import logging

logger = logging.getLogger(__name__)


class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        tenant_id = request.headers.get(settings.tenant_header)
        if tenant_id and tenant_id not in ('null', 'undefined'):
            request.state.tenant_id = tenant_id
            logger.info(f"[TenantMiddleware] Tenant header set: {tenant_id}")
        else:
            request.state.tenant_id = None
            logger.warning(f"[TenantMiddleware] Missing or invalid tenant header: {tenant_id}")
        response = await call_next(request)
        return response
