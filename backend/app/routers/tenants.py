from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import schemas
from app.dependencies import get_db

router = APIRouter()


@router.post("/", response_model=schemas.TenantRead)
def create_tenant(tenant: schemas.TenantCreate, db: Session = Depends(get_db)):
    return tenant


@router.get("/{tenant_id}", response_model=schemas.TenantRead)
def read_tenant(tenant_id: str, db: Session = Depends(get_db)):
    return {"id": tenant_id, "name": "Example Tenant", "domain": "example.com"}
